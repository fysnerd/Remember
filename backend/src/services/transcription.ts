// Transcription Service - Fetches transcripts for YouTube videos
// Uses yt-dlp (primary) for robust subtitle extraction including auto-generated captions
import { prisma } from '../config/database.js';
import { ContentStatus, TranscriptSource, Platform } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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
      // Use --impersonate chrome to avoid rate limiting (requires curl_cffi: pip install curl_cffi)
      const command = `yt-dlp --impersonate chrome --write-auto-sub --sub-lang "${lang}" --sub-format json3 --skip-download -o "${outputBase}" "https://www.youtube.com/watch?v=${videoId}"`;

      console.log(`[Transcription] Running yt-dlp for ${videoId} (lang=${lang})...`);
      await execAsync(command, { timeout: 60000 });

      // Find the downloaded subtitle file
      const files = fs.readdirSync(tempDir);
      const subFile = files.find(f => f.startsWith(`yt_subs_${videoId}_`) && f.endsWith('.json3'));

      if (!subFile) {
        console.log(`[Transcription] No subtitle file for ${videoId} in ${lang}, trying next...`);
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
        console.log(`[Transcription] No text segments for ${videoId} in ${lang}, trying next...`);
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

      console.log(`[Transcription] yt-dlp success: ${segments.length} segments, ${fullText.length} chars, lang=${detectedLang}`);

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

      console.log(`[Transcription] yt-dlp failed for ${videoId} (lang=${lang}): ${error.message?.substring(0, 100) || error}`);
      // Continue to next language
    }
  }

  console.error(`[Transcription] yt-dlp failed for ${videoId} - no subtitles found in any language`);
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
    console.error('[Transcription] yt-dlp is not installed. Please install it with: pip install yt-dlp');
    return null;
  }

  // Use yt-dlp (most reliable for auto-generated captions)
  return fetchYouTubeTranscriptWithYtDlp(videoId, preferredLang);
}

/**
 * Process a content item to get its transcript
 * Called when user clicks "Generate Quiz" on content
 */
export async function processContentTranscript(contentId: string): Promise<boolean> {
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    include: { transcript: true },
  });

  if (!content) {
    console.error(`[Transcription] Content ${contentId} not found`);
    return false;
  }

  // Skip if already has transcript
  if (content.transcript) {
    console.log(`[Transcription] Content ${contentId} already has transcript`);
    return true;
  }

  // Only process YouTube for now (Spotify handled by podcastTranscription.ts)
  if (content.platform !== Platform.YOUTUBE) {
    console.log(`[Transcription] Content ${contentId} is not YouTube, skipping`);
    return false;
  }

  // Update status to transcribing
  await prisma.content.update({
    where: { id: contentId },
    data: { status: ContentStatus.TRANSCRIBING },
  });

  try {
    const result = await fetchYouTubeTranscript(content.externalId);

    if (!result) {
      // No transcript available - mark as failed
      await prisma.content.update({
        where: { id: contentId },
        data: {
          status: ContentStatus.FAILED,
        },
      });
      console.log(`[Transcription] No transcript available for ${content.externalId}`);
      return false;
    }

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

    console.log(`[Transcription] ✅ Successfully transcribed ${content.externalId} (${result.text.length} chars)`);
    return true;

  } catch (error) {
    console.error(`[Transcription] Error processing ${contentId}:`, error);
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

  for (const contentId of contentIds) {
    const result = await processContentTranscript(contentId);
    if (result) {
      success++;
    } else {
      failed++;
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return { success, failed };
}

/**
 * Background worker to process pending transcriptions
 * Processes content items that are in SELECTED status
 */
export async function runTranscriptionWorker(): Promise<void> {
  console.log('[Transcription Worker] Starting...');

  // Get content items that need transcription (SELECTED status, no transcript, YouTube only)
  const pendingContent = await prisma.content.findMany({
    where: {
      status: ContentStatus.SELECTED,
      platform: Platform.YOUTUBE,
      transcript: null,
    },
    take: 5, // Process 5 at a time (yt-dlp is slower than API calls)
    orderBy: { createdAt: 'asc' },
  });

  if (pendingContent.length === 0) {
    console.log('[Transcription Worker] No pending content to process');
    return;
  }

  console.log(`[Transcription Worker] Processing ${pendingContent.length} items`);

  const { success, failed } = await batchProcessTranscripts(
    pendingContent.map(c => c.id)
  );

  console.log(`[Transcription Worker] Completed: ${success} success, ${failed} failed`);
}
