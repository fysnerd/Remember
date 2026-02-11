// Transcription Service - Fetches transcripts for YouTube videos
// Uses yt-dlp (primary) for robust subtitle extraction including auto-generated captions
// Uses global TranscriptCache to avoid redundant calls across users
import { logger } from '../config/logger.js';
import { config } from '../config/env.js';
import { prisma } from '../config/database.js';
import { ContentStatus, TranscriptSource, TranscriptCacheStatus, Platform } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import pLimit from 'p-limit';

const log = logger.child({ service: 'youtube-transcription' });
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

const execAsync = promisify(exec);

// Supported languages in order of preference
const PREFERRED_LANGUAGES = ['fr', 'en', 'es', 'de', 'pt', 'it'];

interface TranscriptSegment {
  start: number;
  duration: number;
  text: string;
}

interface YtDlpEvent {
  tStartMs: number;
  dDurationMs?: number;
  segs?: Array<{ utf8: string }>;
}

/**
 * Extract video ID from various YouTube URL formats
 */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Check if yt-dlp is available on the system
 */
async function isYtDlpAvailable(): Promise<boolean> {
  try {
    await execAsync('yt-dlp --version');
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch YouTube transcript using yt-dlp
 * Supports auto-generated captions (ASR) which youtube-transcript doesn't handle well
 */
export async function fetchYouTubeTranscriptWithYtDlp(
  videoId: string,
  preferredLang?: string
): Promise<{ text: string; segments: TranscriptSegment[]; language: string } | null> {
  const languages = preferredLang
    ? [preferredLang, ...PREFERRED_LANGUAGES.filter(l => l !== preferredLang)]
    : PREFERRED_LANGUAGES;

  const tempDir = os.tmpdir();

  // Try each language one at a time to avoid rate limit errors on multiple languages
  for (const lang of languages) {
    const outputBase = path.join(tempDir, `yt_subs_${videoId}_${Date.now()}`);

    try {
      // Download auto-generated subtitles in JSON3 format
      // Use proxy (configurable via YTDLP_PROXY env var) to avoid YouTube datacenter IP blocking
      // Use --remote-components ejs:github for JS challenge solving
      const proxyArg = config.ytdlp.proxy ? `--proxy ${config.ytdlp.proxy} ` : '';
      const command = `yt-dlp ${proxyArg}--remote-components ejs:github --write-auto-sub --sub-lang "${lang}" --sub-format json3 --skip-download -o "${outputBase}" "https://www.youtube.com/watch?v=${videoId}"`;

      log.debug({ videoId, lang }, 'Downloading subtitles with yt-dlp');
      await execAsync(command, { timeout: 60000 });

      // Find the downloaded subtitle file
      const files = fs.readdirSync(tempDir);
      const subFile = files.find(f => f.startsWith(`yt_subs_${videoId}_`) && f.endsWith('.json3'));

      if (!subFile) {
        log.debug({ videoId, lang }, 'No subtitle file found, trying next language');
        continue;
      }

      const subPath = path.join(tempDir, subFile);
      const content = fs.readFileSync(subPath, 'utf8');

      // Clean up temp file
      fs.unlinkSync(subPath);

      // Parse JSON3 format
      const data = JSON.parse(content);
      const events: YtDlpEvent[] = data.events || [];

      // Filter events that have text segments
      const textEvents = events.filter(e => e.segs && e.segs.length > 0);

      if (textEvents.length === 0) {
        log.debug({ videoId, lang }, 'No text segments found, trying next language');
        continue;
      }

      // Convert to our format
      const segments: TranscriptSegment[] = textEvents.map(event => ({
        start: event.tStartMs / 1000,
        duration: (event.dDurationMs || 0) / 1000,
        text: event.segs!.map(s => s.utf8).join('').trim(),
      })).filter(s => s.text.length > 0);

      // Combine all text
      const fullText = segments
        .map(s => s.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .replace(/\[.*?\]/g, '') // Remove [Music], [Applause], etc.
        .trim();

      // Detect language from filename (e.g., yt_subs_xxx.fr.json3)
      const langMatch = subFile.match(/\.([a-z]{2}(?:-[a-zA-Z]+)?)\.json3$/);
      const detectedLang = langMatch ? langMatch[1] : lang;

      log.info({ videoId, segments: segments.length, chars: fullText.length, language: detectedLang }, 'Subtitle extraction completed');

      return {
        text: fullText,
        segments,
        language: detectedLang,
      };
    } catch (error: any) {
      // Clean up any temp files
      try {
        const files = fs.readdirSync(tempDir);
        files
          .filter(f => f.startsWith(`yt_subs_${videoId}_`))
          .forEach(f => fs.unlinkSync(path.join(tempDir, f)));
      } catch {}

      log.debug({ err: error, videoId, lang }, 'yt-dlp failed for language');
      // Continue to next language
    }
  }

  log.warn({ videoId }, 'No subtitles found in any language');
  return null;
}

/**
 * Fetch YouTube transcript - tries yt-dlp first, no fallback
 */
export async function fetchYouTubeTranscript(
  videoIdOrUrl: string,
  preferredLang?: string
): Promise<{ text: string; segments: TranscriptSegment[]; language: string } | null> {
  const videoId = extractVideoId(videoIdOrUrl) || videoIdOrUrl;

  // Check if yt-dlp is available
  const ytDlpAvailable = await isYtDlpAvailable();

  if (!ytDlpAvailable) {
    log.error('yt-dlp is not installed');
    return null;
  }

  // Use yt-dlp (most reliable for auto-generated captions)
  return fetchYouTubeTranscriptWithYtDlp(videoId, preferredLang);
}

/**
 * Process a content item to get its transcript
 * Called when user clicks "Generate Quiz" on content
 * Uses global cache to avoid redundant transcription calls
 */
export async function processContentTranscript(contentId: string): Promise<boolean> {
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    include: { transcript: true, transcriptCache: true },
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

  // Only process YouTube for now (Spotify handled by podcastTranscription.ts)
  if (content.platform !== Platform.YOUTUBE) {
    log.debug({ contentId, platform: content.platform }, 'Not YouTube content, skipping');
    return false;
  }

  // Check if we have a cached transcript
  if (content.transcriptCache?.status === TranscriptCacheStatus.SUCCESS && content.transcriptCache.text) {
    // Copy from cache
    await copyTranscriptFromCache(contentId, content.transcriptCache);
    log.info({ contentId, cacheHit: true }, 'Copied transcript from cache');
    return true;
  }

  // Check if cache exists but is UNAVAILABLE
  if (content.transcriptCache?.status === TranscriptCacheStatus.UNAVAILABLE) {
    log.warn({ contentId }, 'Transcript cache unavailable');
    return false;
  }

  // Update status to transcribing
  await prisma.content.update({
    where: { id: contentId },
    data: { status: ContentStatus.TRANSCRIBING },
  });

  const workerId = generateWorkerId();

  try {
    // Get or create cache with lock
    const cacheResult = await getOrCreateCacheWithLock(content.platform, content.externalId, workerId);

    if (!cacheResult) {
      // Cache is locked, wait and retry
      log.debug({ contentId }, 'Cache locked, will retry later');
      await prisma.content.update({
        where: { id: contentId },
        data: { status: ContentStatus.SELECTED },
      });
      return false;
    }

    const { cache, acquired } = cacheResult;

    // Cache hit - copy transcript
    if (cache.status === TranscriptCacheStatus.SUCCESS && cache.text) {
      await linkCacheToContent(content.platform, content.externalId, cache.id);
      await copyTranscriptFromCache(contentId, cache);
      await prisma.content.update({
        where: { id: contentId },
        data: { status: ContentStatus.SELECTED },
      });
      log.info({ contentId, cacheHit: true }, 'Transcription completed from cache');
      return true;
    }

    // Need to fetch transcript
    if (!acquired) {
      // Cache is being processed by another worker
      await prisma.content.update({
        where: { id: contentId },
        data: { status: ContentStatus.SELECTED },
      });
      return false;
    }

    const result = await fetchYouTubeTranscript(content.externalId);

    if (!result) {
      // No transcript available
      await markCacheUnavailable(cache.id, 'No subtitles available', workerId);
      await prisma.content.update({
        where: { id: contentId },
        data: {
          status: ContentStatus.FAILED,
          transcriptionFailed: true,
          transcriptCacheId: cache.id,
        },
      });
      log.warn({ contentId, externalId: content.externalId }, 'No transcript available, marked as failed');
      return false;
    }

    // Save to cache
    await markCacheSuccess(cache.id, {
      text: result.text,
      segments: result.segments,
      language: result.language,
      source: TranscriptSource.YOUTUBE_SUBTITLES,
    }, workerId);

    // Link and copy
    await linkCacheToContent(content.platform, content.externalId, cache.id);

    // Save transcript to database
    await prisma.transcript.create({
      data: {
        contentId: content.id,
        text: result.text,
        segments: JSON.parse(JSON.stringify(result.segments)),
        language: result.language,
        source: TranscriptSource.YOUTUBE_SUBTITLES,
      },
    });

    // Update content status back to SELECTED (quiz worker picks up SELECTED + transcript)
    await prisma.content.update({
      where: { id: contentId },
      data: { status: ContentStatus.SELECTED },
    });

    log.info({ contentId, externalId: content.externalId, chars: result.text.length, language: result.language }, 'Transcription completed');
    return true;

  } catch (error) {
    log.error({ err: error, contentId }, 'Transcription failed');
    await prisma.content.update({
      where: { id: contentId },
      data: {
        status: ContentStatus.FAILED,
      },
    });
    return false;
  }
}

/**
 * Batch process multiple content items for transcription
 */
export async function batchProcessTranscripts(contentIds: string[]): Promise<{
  success: number;
  failed: number;
}> {
  let success = 0;
  let failed = 0;

  const limit = pLimit(5); // yt-dlp is free/fast, can run 5 concurrent

  const results = await Promise.allSettled(
    contentIds.map(contentId =>
      limit(() => processContentTranscript(contentId))
    )
  );

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      success++;
    } else {
      failed++;
    }
  }

  return { success, failed };
}

/**
 * Background worker to process pending transcriptions
 * Uses global TranscriptCache to avoid redundant calls across users
 * Processes content items that are in SELECTED or INBOX status
 */
export async function runTranscriptionWorker(): Promise<void> {
  log.info('Starting transcription worker');

  const workerId = generateWorkerId();

  // Clean up any expired locks from crashed workers
  await cleanupExpiredLocks();

  // Get content items that need transcription:
  // 1. SELECTED status (user clicked "Learn") - priority
  // 2. INBOX YouTube content (pre-transcription for faster UX) - free via yt-dlp
  // Excludes content where transcription already failed (no subtitles available)
  const pendingContent = await prisma.content.findMany({
    where: {
      OR: [
        // Priority: User-selected content
        {
          status: ContentStatus.SELECTED,
          platform: Platform.YOUTUBE,
          transcript: null,
          transcriptionFailed: false,
        },
        // Pre-transcription: INBOX YouTube (gratuit via sous-titres)
        {
          status: ContentStatus.INBOX,
          platform: Platform.YOUTUBE,
          transcript: null,
          transcriptionFailed: false,
        },
      ],
    },
    take: 20, // Increased since we deduplicate
    orderBy: [
      // Process SELECTED first, then INBOX
      { status: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  if (pendingContent.length === 0) {
    log.debug('No pending content to process');
    return;
  }

  // Deduplicate by externalId (multiple users may have liked the same video)
  const uniqueVideos = new Map<string, typeof pendingContent[0]>();
  for (const content of pendingContent) {
    if (!uniqueVideos.has(content.externalId)) {
      uniqueVideos.set(content.externalId, content);
    }
  }

  const selectedCount = pendingContent.filter(c => c.status === ContentStatus.SELECTED).length;
  const inboxCount = pendingContent.filter(c => c.status === ContentStatus.INBOX).length;
  log.info({ total: pendingContent.length, unique: uniqueVideos.size, selected: selectedCount, inbox: inboxCount }, 'Found pending transcriptions');

  let success = 0;
  let cacheHits = 0;
  let failed = 0;

  const limit = pLimit(5); // yt-dlp is free/fast

  const results = await Promise.allSettled(
    Array.from(uniqueVideos.values()).map(content =>
      limit(() => processWithCache(workerId, content))
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

  log.info({ success, cacheHits, failed }, 'Transcription worker completed');
}

/**
 * Process a content item using the global cache
 */
async function processWithCache(
  workerId: string,
  content: { id: string; platform: Platform; externalId: string; status: ContentStatus }
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
    // Link cache to all Content records with this externalId
    await linkCacheToContent(content.platform, content.externalId, cache.id);

    // Copy transcript to Content's Transcript table for backward compatibility
    await copyTranscriptToAllContent(content.platform, content.externalId, cache);

    log.debug({ externalId: content.externalId, cacheHit: true }, 'Cache hit for video');
    return 'cache_hit';
  }

  // If cache is UNAVAILABLE and not retrying, mark content as failed
  if (cache.status === TranscriptCacheStatus.UNAVAILABLE && !acquired) {
    await markContentTranscriptionFailed(content.platform, content.externalId);
    return 'failed';
  }

  // We acquired the lock, need to fetch transcript
  if (!acquired) {
    return 'failed';
  }

  try {
    const transcript = await fetchYouTubeTranscript(content.externalId);

    if (transcript) {
      // Mark cache as success
      await markCacheSuccess(cache.id, {
        text: transcript.text,
        segments: transcript.segments,
        language: transcript.language,
        source: TranscriptSource.YOUTUBE_SUBTITLES,
      }, workerId);

      // Link and copy to all Content records
      await linkCacheToContent(content.platform, content.externalId, cache.id);
      await copyTranscriptToAllContent(content.platform, content.externalId, {
        text: transcript.text,
        segments: transcript.segments,
        language: transcript.language,
        source: TranscriptSource.YOUTUBE_SUBTITLES,
      });

      // Update status for SELECTED content
      await updateContentStatusAfterTranscription(content.platform, content.externalId);

      log.info({ externalId: content.externalId, chars: transcript.text.length, language: transcript.language }, 'Transcription completed successfully');
      return 'success';

    } else {
      // No subtitles available
      await markCacheUnavailable(cache.id, 'No subtitles available', workerId);
      await markContentTranscriptionFailed(content.platform, content.externalId);

      log.warn({ externalId: content.externalId }, 'Transcript unavailable');
      return 'failed';
    }

  } catch (error: any) {
    await markCacheFailed(cache.id, error, workerId);
    log.error({ err: error, externalId: content.externalId }, 'Transcription error');
    return 'failed';
  }
}

/**
 * Copy transcript from cache to all Content records with this externalId
 */
async function copyTranscriptToAllContent(
  platform: Platform,
  externalId: string,
  cache: { text: string | null; segments: any; language: string | null; source: TranscriptSource | null }
): Promise<void> {
  if (!cache.text || !cache.source) return;

  // Get all content IDs that need transcripts
  const contents = await prisma.content.findMany({
    where: {
      platform,
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
 * Update content status after successful transcription
 */
async function updateContentStatusAfterTranscription(
  _platform: Platform,
  _externalId: string
): Promise<void> {
  // SELECTED content stays SELECTED (quiz worker picks it up)
  // INBOX content stays INBOX (pre-transcription)
  // No status change needed - just having the transcript is enough
}

/**
 * Mark all content with this externalId as transcription failed
 */
async function markContentTranscriptionFailed(
  platform: Platform,
  externalId: string
): Promise<void> {
  await prisma.content.updateMany({
    where: {
      platform,
      externalId,
      transcriptionFailed: false,
    },
    data: {
      transcriptionFailed: true,
    },
  });
}

