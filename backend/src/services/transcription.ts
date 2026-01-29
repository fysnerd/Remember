// Transcription Service - Fetches transcripts for YouTube videos
// Uses youtube-transcript package (FREE) for subtitle extraction
import { prisma } from '../config/database.js';
import { ContentStatus, TranscriptSource, Platform } from '@prisma/client';
import { YoutubeTranscript, TranscriptResponse } from 'youtube-transcript';

// Supported languages in order of preference
const PREFERRED_LANGUAGES = ['en', 'en-US', 'en-GB', 'fr', 'es', 'de', 'pt', 'it'];

interface TranscriptSegment {
  start: number;
  duration: number;
  text: string;
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
 * Fetch YouTube transcript using youtube-transcript package
 * This is FREE and works for most videos with captions enabled
 */
export async function fetchYouTubeTranscript(
  videoIdOrUrl: string,
  preferredLang?: string
): Promise<{ text: string; segments: TranscriptSegment[]; language: string } | null> {
  const videoId = extractVideoId(videoIdOrUrl) || videoIdOrUrl;

  try {
    // Try to fetch transcript with preferred language
    const languages = preferredLang
      ? [preferredLang, ...PREFERRED_LANGUAGES.filter(l => l !== preferredLang)]
      : PREFERRED_LANGUAGES;

    let transcript: TranscriptResponse[] | null = null;
    let usedLanguage = 'en';

    // Try each language until we find one that works
    for (const lang of languages) {
      try {
        transcript = await YoutubeTranscript.fetchTranscript(videoId, {
          lang,
        });
        usedLanguage = lang;
        break;
      } catch (error) {
        // Language not available, try next
        continue;
      }
    }

    // If no preferred language worked, try without language filter
    if (!transcript) {
      try {
        transcript = await YoutubeTranscript.fetchTranscript(videoId);
        usedLanguage = 'auto';
      } catch (error) {
        // No transcript available at all
        return null;
      }
    }

    if (!transcript || transcript.length === 0) {
      return null;
    }

    // Convert to our format
    const segments: TranscriptSegment[] = transcript.map(item => ({
      start: item.offset / 1000, // Convert ms to seconds
      duration: item.duration / 1000,
      text: item.text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim(),
    }));

    // Combine all text
    const fullText = segments.map(s => s.text).join(' ').replace(/\s+/g, ' ').trim();

    return {
      text: fullText,
      segments,
      language: usedLanguage,
    };
  } catch (error) {
    console.error(`[Transcription] Error fetching transcript for ${videoId}:`, error);
    return null;
  }
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

  // Only process YouTube for now (Spotify will be Sprint 3)
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

    // Update content status
    await prisma.content.update({
      where: { id: contentId },
      data: { status: ContentStatus.SELECTED }, // Ready for quiz generation
    });

    console.log(`[Transcription] Successfully transcribed ${content.externalId} (${result.text.length} chars)`);
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
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return { success, failed };
}

/**
 * Background worker to process pending transcriptions
 * Processes content items that are in SELECTED status
 */
export async function runTranscriptionWorker(): Promise<void> {
  console.log('[Transcription Worker] Starting...');

  // Get content items that need transcription (SELECTED status, no transcript, YouTube only for now)
  const pendingContent = await prisma.content.findMany({
    where: {
      status: ContentStatus.SELECTED,
      platform: Platform.YOUTUBE,
      transcript: null,
    },
    take: 10, // Process 10 at a time
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
