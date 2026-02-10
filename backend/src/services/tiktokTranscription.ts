// TikTok Transcription Service - Download video + Whisper transcription
// Pattern based on podcastTranscription.ts
// Uses global TranscriptCache to avoid redundant transcription calls
import { logger } from '../config/logger.js';
import { config } from '../config/env.js';
import { prisma } from '../config/database.js';

const log = logger.child({ service: 'tiktok-transcription' });
import { ContentStatus, TranscriptSource, TranscriptCacheStatus, Platform } from '@prisma/client';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';
import pLimit from 'p-limit';
import { groqLimiter } from '../utils/rateLimiter.js';
import {
  generateWorkerId,
  getOrCreateCacheWithLock,
  markCacheSuccess,
  markCacheUnavailable,
  markCacheFailed,
  linkCacheToContent,
  copyTranscriptFromCache,
  cleanupExpiredLocks,
} from './transcriptCache.js';

// Initialize Groq client (free Whisper) - falls back to OpenAI if Groq not available
const groqClient = config.groq?.apiKey
  ? new OpenAI({
      apiKey: config.groq.apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    })
  : null;

// Fallback to OpenAI if Groq not configured
const openaiClient = config.openai.apiKey
  ? new OpenAI({ apiKey: config.openai.apiKey })
  : null;

// Use Groq by default (free), fallback to OpenAI
const whisperClient = groqClient || openaiClient;

interface TranscriptSegment {
  start: number;
  duration: number;
  text: string;
}

// Minimum transcript length to be considered valid (filters music-only videos)
const MIN_TRANSCRIPT_LENGTH = 50;

// yt-dlp error patterns that are permanent (will never succeed without user action)
const PERMANENT_ERROR_PATTERNS = [
  'Log in for access',
  'login required',
  'not comfortable for some audiences',
  'Private video',
  'Video unavailable',
  'has been removed',
  'been deleted',
  'does not exist',
  'account is private',
  'content is not available',
  'This video is no longer available',
  'Requested format is not available',
];

/**
 * Download TikTok video using yt-dlp
 * Uses execFile with args array to prevent command injection
 */
async function downloadTikTokVideo(url: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Use execFile with args array to prevent command injection (F1 fix)
    const args = ['--no-warnings', '-f', 'best[ext=mp4]/best', '-o', outputPath, url];
    execFile('yt-dlp', args, { timeout: 120000 }, (error, _stdout, stderr) => {
      if (error) {
        log.error({ stderr }, 'yt-dlp error');
        reject(new Error(`yt-dlp failed: ${error.message}`));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Extract audio from video using ffmpeg
 * Uses execFile with args array to prevent command injection
 */
async function extractAudio(videoPath: string, audioPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Use execFile with args array to prevent command injection (F1 fix)
    const args = ['-y', '-i', videoPath, '-vn', '-acodec', 'libmp3lame', '-q:a', '2', audioPath];
    execFile('ffmpeg', args, { timeout: 60000 }, (error, _stdout, stderr) => {
      if (error) {
        log.error({ stderr }, 'ffmpeg error');
        reject(new Error(`ffmpeg failed: ${error.message}`));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Compress audio file using ffmpeg to reduce file size (for Groq 25MB limit)
 * Uses execFile with args array to prevent command injection
 */
async function compressAudio(inputPath: string): Promise<string> {
  const outputPath = inputPath.replace('.mp3', '_compressed.mp3');

  return new Promise((resolve, reject) => {
    // Compress to mono, 16kHz (good enough for speech), 32kbps
    // Use execFile with args array to prevent command injection (F1 fix)
    const args = ['-y', '-i', inputPath, '-ac', '1', '-ar', '16000', '-b:a', '32k', outputPath];
    execFile('ffmpeg', args, { timeout: 300000 }, (error, _stdout, stderr) => {
      if (error) {
        log.error({ stderr }, 'ffmpeg compression error');
        reject(new Error(`ffmpeg compression failed: ${error.message}`));
        return;
      }
      resolve(outputPath);
    });
  });
}

/**
 * Transcribe audio using Whisper API (Groq free or OpenAI)
 */
async function transcribeWithWhisper(audioPath: string): Promise<{
  text: string;
  segments: TranscriptSegment[];
  language: string;
}> {
  if (!whisperClient) {
    throw new Error('No Whisper API configured. Set GROQ_API_KEY (free) or OPENAI_API_KEY.');
  }

  const audioFile = fs.createReadStream(audioPath);
  const isGroq = !!groqClient;

  // Groq uses whisper-large-v3, OpenAI uses whisper-1
  const model = isGroq ? 'whisper-large-v3' : 'whisper-1';

  log.debug({ provider: isGroq ? 'Groq' : 'OpenAI' }, 'Using Whisper for transcription');

  // Use verbose_json for timestamped segments
  const transcription = await whisperClient.audio.transcriptions.create({
    file: audioFile,
    model,
    response_format: 'verbose_json',
    ...(isGroq ? {} : { timestamp_granularities: ['segment'] }),
  });

  // Extract segments from response
  const segments: TranscriptSegment[] = (transcription as any).segments?.map((seg: any) => ({
    start: seg.start,
    duration: seg.end - seg.start,
    text: seg.text.trim(),
  })) || [];

  return {
    text: transcription.text,
    segments,
    language: (transcription as any).language || 'fr',
  };
}

/**
 * Clean up temporary files
 */
function cleanupFiles(...filePaths: string[]): void {
  for (const filePath of filePaths) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      log.error({ err: error, filePath }, 'Failed to cleanup file');
    }
  }
}

/**
 * Process a TikTok video for transcription
 */
export async function processTikTokTranscript(contentId: string): Promise<boolean> {
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    include: { transcript: true },
  });

  if (!content) {
    log.error({ contentId }, 'Content not found');
    return false;
  }

  // Skip if already has transcript
  if (content.transcript) {
    log.debug({ contentId }, 'Content already has transcript');
    return true;
  }

  // Only process TikTok content
  if (content.platform !== Platform.TIKTOK) {
    log.debug({ contentId, platform: content.platform }, 'Not TikTok content, skipping');
    return false;
  }

  // Update status to transcribing
  await prisma.content.update({
    where: { id: contentId },
    data: { status: ContentStatus.TRANSCRIBING },
  });

  const tempDir = os.tmpdir();
  const videoPath = path.join(tempDir, `tiktok_${contentId}.mp4`);
  const audioPath = path.join(tempDir, `tiktok_${contentId}.mp3`);
  let compressedPath: string | null = null;

  try {
    // Step 1: Download video via yt-dlp
    log.debug({ externalId: content.externalId, url: content.url }, 'Downloading video');
    await downloadTikTokVideo(content.url, videoPath);

    // Step 2: Extract audio via ffmpeg
    log.debug({ externalId: content.externalId }, 'Extracting audio');
    await extractAudio(videoPath, audioPath);

    // Remove video file (no longer needed)
    cleanupFiles(videoPath);

    // Step 3: Check file size and compress if needed (Groq limit: 25MB)
    const stats = fs.statSync(audioPath);
    const maxSize = 25 * 1024 * 1024; // 25MB

    let finalAudioPath = audioPath;
    if (groqClient && stats.size > maxSize) {
      log.info({ externalId: content.externalId, sizeMB: Math.round(stats.size / 1024 / 1024) }, 'Audio too large, compressing');
      compressedPath = await compressAudio(audioPath);
      cleanupFiles(audioPath);
      finalAudioPath = compressedPath;

      const compressedStats = fs.statSync(compressedPath);
      log.info({ externalId: content.externalId, sizeMB: Math.round(compressedStats.size / 1024 / 1024 * 100) / 100 }, 'Audio compressed');

      if (compressedStats.size > maxSize) {
        throw new Error(`File still too large after compression (${Math.round(compressedStats.size / 1024 / 1024)}MB > 25MB limit)`);
      }
    }

    // Step 4: Transcribe with Whisper (rate limited)
    log.debug({ externalId: content.externalId }, 'Transcribing with Whisper');
    const result = await groqLimiter(() => transcribeWithWhisper(finalAudioPath));

    // Note: Local transcribeWithWhisper doesn't auto-cleanup, handled in finally block

    // Step 5: Check if transcript is valid (filters music-only videos)
    if (result.text.length < MIN_TRANSCRIPT_LENGTH) {
      log.warn({ contentId, textLength: result.text.length, minLength: MIN_TRANSCRIPT_LENGTH }, 'Transcript too short, marking as unsupported');
      await prisma.content.update({
        where: { id: contentId },
        data: { status: ContentStatus.UNSUPPORTED },
      });
      return false;
    }

    // Step 6: Save transcript
    await prisma.transcript.create({
      data: {
        contentId: content.id,
        text: result.text,
        segments: JSON.parse(JSON.stringify(result.segments)),
        language: result.language,
        source: TranscriptSource.WHISPER,
      },
    });

    // Update content status back to SELECTED
    await prisma.content.update({
      where: { id: contentId },
      data: { status: ContentStatus.SELECTED },
    });

    log.info({ contentId, title: content.title, chars: result.text.length, language: result.language }, 'TikTok transcription completed');
    return true;

  } catch (error: any) {
    log.error({ err: error, contentId, title: content.title }, 'TikTok transcription failed');

    await prisma.content.update({
      where: { id: contentId },
      data: { status: ContentStatus.FAILED },
    });
    return false;
  } finally {
    // F2 fix: Cleanup in finally block to ensure temp files are always removed
    cleanupFiles(videoPath, audioPath);
    if (compressedPath) cleanupFiles(compressedPath);
  }
}

/**
 * Background worker to process pending TikTok transcriptions
 * Uses global TranscriptCache to avoid redundant Whisper calls
 */
export async function runTikTokTranscriptionWorker(): Promise<void> {
  log.info('Starting TikTok transcription worker');

  const workerId = generateWorkerId();

  // Clean up any expired locks
  await cleanupExpiredLocks();

  // Get TikTok content items that need transcription (SELECTED priority, then INBOX)
  const pendingContent = await prisma.content.findMany({
    where: {
      OR: [
        { status: ContentStatus.SELECTED },
        { status: ContentStatus.INBOX },
      ],
      platform: Platform.TIKTOK,
      transcript: null,
    },
    take: 20,
    orderBy: { createdAt: 'asc' },
  });

  if (pendingContent.length === 0) {
    log.debug('No pending TikToks to process');
    return;
  }

  // Deduplicate by externalId (multiple users may have liked the same video)
  const uniqueVideos = new Map<string, typeof pendingContent[0]>();
  for (const content of pendingContent) {
    if (!uniqueVideos.has(content.externalId)) {
      uniqueVideos.set(content.externalId, content);
    }
  }

  log.info({ total: pendingContent.length, unique: uniqueVideos.size }, 'Found pending TikToks');

  let success = 0;
  let cacheHits = 0;
  let failed = 0;

  const limit = pLimit(3); // Download + Whisper, limit concurrency

  const results = await Promise.allSettled(
    Array.from(uniqueVideos.values()).map(content =>
      limit(() => processTikTokWithCache(workerId, content))
    )
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      if (result.value === 'success') success++;
      else if (result.value === 'cache_hit') cacheHits++;
      else failed++;
    } else {
      failed++;
    }
  }

  log.info({ success, cacheHits, failed }, 'TikTok transcription worker completed');
}

/**
 * Process a TikTok video using the global cache
 */
async function processTikTokWithCache(
  workerId: string,
  content: { id: string; platform: Platform; externalId: string; title: string; url: string }
): Promise<'success' | 'cache_hit' | 'failed'> {
  // Try to get or create cache entry with lock
  const result = await getOrCreateCacheWithLock(content.platform, content.externalId, workerId);

  if (!result) {
    // Cache is locked by another worker, skip for now
    return 'failed';
  }

  const { cache, acquired } = result;

  // If cache already has transcript (SUCCESS), just link and copy
  if (cache.status === TranscriptCacheStatus.SUCCESS && cache.text) {
    await linkCacheToContent(content.platform, content.externalId, cache.id);
    await copyTranscriptToAllTikTokContent(content.externalId, cache);
    log.debug({ externalId: content.externalId, cacheHit: true }, 'Cache hit for TikTok video');
    return 'cache_hit';
  }

  // If cache is UNAVAILABLE and not retrying, mark content as unsupported
  if (cache.status === TranscriptCacheStatus.UNAVAILABLE && !acquired) {
    await markTikTokContentUnsupported(content.externalId);
    return 'failed';
  }

  // If cache is FAILED and waiting for backoff, check if it's a permanent error
  if (cache.status === TranscriptCacheStatus.FAILED && !acquired) {
    if (cache.failureReason && PERMANENT_ERROR_PATTERNS.some(p => cache.failureReason!.toLowerCase().includes(p.toLowerCase()))) {
      log.warn({ externalId: content.externalId }, 'Cache has permanent failure, marking content unsupported');
      await markTikTokContentUnsupported(content.externalId);
    }
    return 'failed';
  }

  // We acquired the lock, need to fetch transcript
  if (!acquired) {
    return 'failed';
  }

  const tempDir = os.tmpdir();
  const videoPath = path.join(tempDir, `tiktok_${content.id}.mp4`);
  const audioPath = path.join(tempDir, `tiktok_${content.id}.mp3`);
  let compressedPath: string | null = null;

  try {
    // Step 1: Download video via yt-dlp
    log.debug({ externalId: content.externalId, url: content.url }, 'Downloading video');
    await downloadTikTokVideo(content.url, videoPath);

    // Step 2: Extract audio via ffmpeg
    log.debug({ externalId: content.externalId }, 'Extracting audio');
    await extractAudio(videoPath, audioPath);

    // Remove video file (no longer needed)
    cleanupFiles(videoPath);

    // Step 3: Check file size and compress if needed (Groq limit: 25MB)
    const stats = fs.statSync(audioPath);
    const maxSize = 25 * 1024 * 1024; // 25MB

    let finalAudioPath = audioPath;
    if (groqClient && stats.size > maxSize) {
      log.info({ externalId: content.externalId, sizeMB: Math.round(stats.size / 1024 / 1024) }, 'Audio too large, compressing');
      compressedPath = await compressAudio(audioPath);
      cleanupFiles(audioPath);
      finalAudioPath = compressedPath;

      const compressedStats = fs.statSync(compressedPath);
      log.info({ externalId: content.externalId, sizeMB: Math.round(compressedStats.size / 1024 / 1024 * 100) / 100 }, 'Audio compressed');

      if (compressedStats.size > maxSize) {
        throw new Error(`File still too large after compression (${Math.round(compressedStats.size / 1024 / 1024)}MB > 25MB limit)`);
      }
    }

    // Step 4: Transcribe with Whisper (rate limited)
    log.debug({ externalId: content.externalId }, 'Transcribing with Whisper');
    const transcript = await groqLimiter(() => transcribeWithWhisper(finalAudioPath));

    // Cleanup audio files
    cleanupFiles(finalAudioPath);
    if (compressedPath && compressedPath !== finalAudioPath) cleanupFiles(compressedPath);

    // Step 5: Check if transcript is valid (filters music-only videos)
    if (transcript.text.length < MIN_TRANSCRIPT_LENGTH) {
      log.warn({ externalId: content.externalId, textLength: transcript.text.length, minLength: MIN_TRANSCRIPT_LENGTH }, 'Transcript too short, marking as unsupported');
      await markCacheUnavailable(cache.id, 'Transcript too short (music-only video)', workerId);
      await markTikTokContentUnsupported(content.externalId);
      return 'failed';
    }

    // Step 6: Save to cache
    await markCacheSuccess(cache.id, {
      text: transcript.text,
      segments: transcript.segments,
      language: transcript.language,
      source: TranscriptSource.WHISPER,
    }, workerId);

    // Step 7: Link and copy to all Content records
    await linkCacheToContent(content.platform, content.externalId, cache.id);
    await copyTranscriptToAllTikTokContent(content.externalId, {
      text: transcript.text,
      segments: transcript.segments,
      language: transcript.language,
      source: TranscriptSource.WHISPER,
    });

    // Update status for all content with this externalId
    await prisma.content.updateMany({
      where: {
        platform: Platform.TIKTOK,
        externalId: content.externalId,
        status: ContentStatus.TRANSCRIBING,
      },
      data: { status: ContentStatus.SELECTED },
    });

    log.info({ externalId: content.externalId, title: content.title, chars: transcript.text.length, language: transcript.language }, 'TikTok transcription completed successfully');
    return 'success';

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isPermanent = PERMANENT_ERROR_PATTERNS.some(pattern =>
      errorMessage.toLowerCase().includes(pattern.toLowerCase())
    );

    if (isPermanent) {
      log.warn({ externalId: content.externalId, reason: errorMessage.substring(0, 200) }, 'Permanent TikTok error, marking as unavailable');
      await markCacheUnavailable(cache.id, `Permanent: ${errorMessage.substring(0, 300)}`, workerId);
      await markTikTokContentUnsupported(content.externalId);
    } else {
      await markCacheFailed(cache.id, error, workerId);
      log.error({ err: error, externalId: content.externalId }, 'TikTok transcription error (transient)');
    }
    return 'failed';
  } finally {
    // Cleanup in finally block to ensure temp files are always removed
    cleanupFiles(videoPath, audioPath);
    if (compressedPath) cleanupFiles(compressedPath);
  }
}

/**
 * Copy transcript from cache to all TikTok Content records with this externalId
 */
async function copyTranscriptToAllTikTokContent(
  externalId: string,
  cache: { text: string | null; segments: any; language: string | null; source: TranscriptSource | null }
): Promise<void> {
  if (!cache.text || !cache.source) return;

  const contents = await prisma.content.findMany({
    where: {
      platform: Platform.TIKTOK,
      externalId,
      transcript: null,
    },
    select: { id: true },
  });

  for (const content of contents) {
    try {
      await copyTranscriptFromCache(content.id, cache);
    } catch (error) {
      // Ignore duplicate errors
    }
  }
}

/**
 * Mark all TikTok content with this externalId as unsupported
 */
async function markTikTokContentUnsupported(externalId: string): Promise<void> {
  await prisma.content.updateMany({
    where: {
      platform: Platform.TIKTOK,
      externalId,
      status: { not: ContentStatus.UNSUPPORTED },
    },
    data: { status: ContentStatus.UNSUPPORTED },
  });
}
