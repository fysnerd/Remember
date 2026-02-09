// Instagram Transcription Service - Download reel video + Whisper transcription
// Pattern based on tiktokTranscription.ts
// Uses global TranscriptCache to avoid redundant transcription calls
import { config } from '../config/env.js';
import { prisma } from '../config/database.js';
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

// Minimum transcript length to be considered valid (filters music-only reels)
const MIN_TRANSCRIPT_LENGTH = 50;

/**
 * Download Instagram reel using yt-dlp (yt-dlp supports Instagram!)
 * Uses execFile with args array to prevent command injection
 */
async function downloadInstagramReel(url: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Use execFile with args array to prevent command injection
    const args = ['--no-warnings', '-f', 'best[ext=mp4]/best', '-o', outputPath, url];
    execFile('yt-dlp', args, { timeout: 120000 }, (error, _stdout, stderr) => {
      if (error) {
        console.error('[Instagram] yt-dlp error:', stderr);
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
    // Use execFile with args array to prevent command injection
    const args = ['-y', '-i', videoPath, '-vn', '-acodec', 'libmp3lame', '-q:a', '2', audioPath];
    execFile('ffmpeg', args, { timeout: 60000 }, (error, _stdout, stderr) => {
      if (error) {
        console.error('[Instagram] ffmpeg error:', stderr);
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
    // Use execFile with args array to prevent command injection
    const args = ['-y', '-i', inputPath, '-ac', '1', '-ar', '16000', '-b:a', '32k', outputPath];
    execFile('ffmpeg', args, { timeout: 300000 }, (error, _stdout, stderr) => {
      if (error) {
        console.error('[Instagram] ffmpeg compression error:', stderr);
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

  console.log(`[Instagram] Using ${isGroq ? 'Groq (free)' : 'OpenAI'} for transcription`);

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
      console.error(`[Instagram] Failed to cleanup ${filePath}:`, error);
    }
  }
}

/**
 * Process an Instagram reel for transcription
 */
export async function processInstagramTranscript(contentId: string): Promise<boolean> {
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    include: { transcript: true },
  });

  if (!content) {
    console.error(`[Instagram] Content ${contentId} not found`);
    return false;
  }

  // Skip if already has transcript
  if (content.transcript) {
    console.log(`[Instagram] Content ${contentId} already has transcript`);
    return true;
  }

  // Only process Instagram content
  if (content.platform !== Platform.INSTAGRAM) {
    console.log(`[Instagram] Content ${contentId} is not Instagram, skipping`);
    return false;
  }

  // Update status to transcribing
  await prisma.content.update({
    where: { id: contentId },
    data: { status: ContentStatus.TRANSCRIBING },
  });

  const tempDir = os.tmpdir();
  const videoPath = path.join(tempDir, `instagram_${contentId}.mp4`);
  const audioPath = path.join(tempDir, `instagram_${contentId}.mp3`);
  let compressedPath: string | null = null;

  try {
    // Step 1: Download video via yt-dlp (supports Instagram!)
    console.log(`[Instagram] Downloading: ${content.url}`);
    await downloadInstagramReel(content.url, videoPath);

    // Step 2: Extract audio via ffmpeg
    console.log(`[Instagram] Extracting audio...`);
    await extractAudio(videoPath, audioPath);

    // Remove video file (no longer needed)
    cleanupFiles(videoPath);

    // Step 3: Check file size and compress if needed (Groq limit: 25MB)
    const stats = fs.statSync(audioPath);
    const maxSize = 25 * 1024 * 1024; // 25MB

    let finalAudioPath = audioPath;
    if (groqClient && stats.size > maxSize) {
      console.log(`[Instagram] Audio too large (${Math.round(stats.size / 1024 / 1024)}MB), compressing...`);
      compressedPath = await compressAudio(audioPath);
      cleanupFiles(audioPath);
      finalAudioPath = compressedPath;

      const compressedStats = fs.statSync(compressedPath);
      console.log(`[Instagram] Compressed to ${Math.round(compressedStats.size / 1024 / 1024 * 100) / 100}MB`);

      if (compressedStats.size > maxSize) {
        throw new Error(`File still too large after compression (${Math.round(compressedStats.size / 1024 / 1024)}MB > 25MB limit)`);
      }
    }

    // Step 4: Transcribe with Whisper (rate limited)
    console.log(`[Instagram] Transcribing with Whisper...`);
    const result = await groqLimiter(() => transcribeWithWhisper(finalAudioPath));

    // Step 5: Check if transcript is valid (filters music-only reels)
    if (result.text.length < MIN_TRANSCRIPT_LENGTH) {
      console.log(`[Instagram] Transcript too short (${result.text.length} < ${MIN_TRANSCRIPT_LENGTH} chars) - marking as UNSUPPORTED`);
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

    console.log(`[Instagram] Successfully transcribed "${content.title}" (${result.text.length} chars, ${result.language})`);
    return true;

  } catch (error: any) {
    console.error(`[Instagram] Error processing ${content.title}:`, error.message || error);

    await prisma.content.update({
      where: { id: contentId },
      data: { status: ContentStatus.FAILED },
    });
    return false;
  } finally {
    // Cleanup in finally block to ensure temp files are always removed
    cleanupFiles(videoPath, audioPath);
    if (compressedPath) cleanupFiles(compressedPath);
  }
}

/**
 * Background worker to process pending Instagram transcriptions
 * Uses global TranscriptCache to avoid redundant Whisper calls
 */
export async function runInstagramTranscriptionWorker(): Promise<void> {
  console.log('[Instagram Worker] Starting...');

  const workerId = generateWorkerId();

  // Clean up any expired locks
  await cleanupExpiredLocks();

  // Get Instagram content items that need transcription
  const pendingContent = await prisma.content.findMany({
    where: {
      status: ContentStatus.SELECTED,
      platform: Platform.INSTAGRAM,
      transcript: null,
    },
    take: 10, // Increased since we deduplicate
    orderBy: { createdAt: 'asc' },
  });

  if (pendingContent.length === 0) {
    console.log('[Instagram Worker] No pending Instagram reels to process');
    return;
  }

  // Deduplicate by externalId (multiple users may have liked the same reel)
  const uniqueReels = new Map<string, typeof pendingContent[0]>();
  for (const content of pendingContent) {
    if (!uniqueReels.has(content.externalId)) {
      uniqueReels.set(content.externalId, content);
    }
  }

  console.log(`[Instagram Worker] Processing ${pendingContent.length} items → ${uniqueReels.size} unique reels`);

  let success = 0;
  let cacheHits = 0;
  let failed = 0;

  const limit = pLimit(3); // Download + Whisper, limit concurrency

  const results = await Promise.allSettled(
    Array.from(uniqueReels.values()).map(content =>
      limit(() => processInstagramWithCache(workerId, content))
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

  console.log(`[Instagram Worker] Completed: ${success} transcribed, ${cacheHits} cache hits, ${failed} failed`);
}

/**
 * Process an Instagram reel using the global cache
 */
async function processInstagramWithCache(
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
    await copyTranscriptToAllInstagramContent(content.externalId, cache);
    console.log(`[Instagram] Cache hit for ${content.externalId}`);
    return 'cache_hit';
  }

  // If cache is UNAVAILABLE and not retrying, mark content as unsupported
  if (cache.status === TranscriptCacheStatus.UNAVAILABLE && !acquired) {
    await markInstagramContentUnsupported(content.externalId);
    return 'failed';
  }

  // If cache is FAILED and waiting for backoff, skip silently
  if (cache.status === TranscriptCacheStatus.FAILED && !acquired) {
    return 'failed';
  }

  // We acquired the lock, need to fetch transcript
  if (!acquired) {
    return 'failed';
  }

  const tempDir = os.tmpdir();
  const videoPath = path.join(tempDir, `instagram_${content.id}.mp4`);
  const audioPath = path.join(tempDir, `instagram_${content.id}.mp3`);
  let compressedPath: string | null = null;

  try {
    // Step 1: Download video via yt-dlp
    console.log(`[Instagram] Downloading: ${content.url}`);
    await downloadInstagramReel(content.url, videoPath);

    // Step 2: Extract audio via ffmpeg
    console.log(`[Instagram] Extracting audio...`);
    await extractAudio(videoPath, audioPath);

    // Remove video file (no longer needed)
    cleanupFiles(videoPath);

    // Step 3: Check file size and compress if needed (Groq limit: 25MB)
    const stats = fs.statSync(audioPath);
    const maxSize = 25 * 1024 * 1024; // 25MB

    let finalAudioPath = audioPath;
    if (groqClient && stats.size > maxSize) {
      console.log(`[Instagram] Audio too large (${Math.round(stats.size / 1024 / 1024)}MB), compressing...`);
      compressedPath = await compressAudio(audioPath);
      cleanupFiles(audioPath);
      finalAudioPath = compressedPath;

      const compressedStats = fs.statSync(compressedPath);
      console.log(`[Instagram] Compressed to ${Math.round(compressedStats.size / 1024 / 1024 * 100) / 100}MB`);

      if (compressedStats.size > maxSize) {
        throw new Error(`File still too large after compression (${Math.round(compressedStats.size / 1024 / 1024)}MB > 25MB limit)`);
      }
    }

    // Step 4: Transcribe with Whisper (rate limited)
    console.log(`[Instagram] Transcribing with Whisper...`);
    const transcript = await groqLimiter(() => transcribeWithWhisper(finalAudioPath));

    // Cleanup audio files
    cleanupFiles(finalAudioPath);
    if (compressedPath && compressedPath !== finalAudioPath) cleanupFiles(compressedPath);

    // Step 5: Check if transcript is valid (filters music-only reels)
    if (transcript.text.length < MIN_TRANSCRIPT_LENGTH) {
      console.log(`[Instagram] Transcript too short (${transcript.text.length} < ${MIN_TRANSCRIPT_LENGTH} chars) - marking as UNSUPPORTED`);
      await markCacheUnavailable(cache.id, 'Transcript too short (music-only reel)', workerId);
      await markInstagramContentUnsupported(content.externalId);
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
    await copyTranscriptToAllInstagramContent(content.externalId, {
      text: transcript.text,
      segments: transcript.segments,
      language: transcript.language,
      source: TranscriptSource.WHISPER,
    });

    // Update status for all content with this externalId
    await prisma.content.updateMany({
      where: {
        platform: Platform.INSTAGRAM,
        externalId: content.externalId,
        status: ContentStatus.TRANSCRIBING,
      },
      data: { status: ContentStatus.SELECTED },
    });

    console.log(`[Instagram] ✅ ${content.externalId} - SUCCESS (${transcript.text.length} chars)`);
    return 'success';

  } catch (error: any) {
    await markCacheFailed(cache.id, error, workerId);
    console.error(`[Instagram] ${content.externalId} - ERROR: ${error.message}`);
    return 'failed';
  } finally {
    // Cleanup in finally block to ensure temp files are always removed
    cleanupFiles(videoPath, audioPath);
    if (compressedPath) cleanupFiles(compressedPath);
  }
}

/**
 * Copy transcript from cache to all Instagram Content records with this externalId
 */
async function copyTranscriptToAllInstagramContent(
  externalId: string,
  cache: { text: string | null; segments: any; language: string | null; source: TranscriptSource | null }
): Promise<void> {
  if (!cache.text || !cache.source) return;

  const contents = await prisma.content.findMany({
    where: {
      platform: Platform.INSTAGRAM,
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
 * Mark all Instagram content with this externalId as unsupported
 */
async function markInstagramContentUnsupported(externalId: string): Promise<void> {
  await prisma.content.updateMany({
    where: {
      platform: Platform.INSTAGRAM,
      externalId,
      status: { not: ContentStatus.UNSUPPORTED },
    },
    data: { status: ContentStatus.UNSUPPORTED },
  });
}
