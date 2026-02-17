// User Pipeline Service — chains transcription → quiz → tags after sync
// Runs in background after /content/refresh completes sync phase
//
// Scalability safeguards:
// - Global pipelineLimiter(3): max 3 user pipelines concurrently on the VPS
// - Per-user dedup: won't start a second pipeline if one is already running
// - Per-step pLimit: controls concurrency within each phase
// - Shared rate limiters (groqLimiter, llmLimiter) in rateLimiter.ts are
//   respected by the underlying service functions — no risk of API overload
// - Cron workers are idempotent: if cron processes the same content, it's a no-op

import { prisma } from '../config/database.js';
import { Platform } from '@prisma/client';
import { processContentTranscript } from './transcription.js';
import { processTikTokTranscript } from './tiktokTranscription.js';
import { processInstagramTranscript } from './instagramTranscription.js';
import { processPodcastTranscript } from './podcastTranscription.js';
import { processContentQuiz } from './quizGeneration.js';
import { autoTagContent } from './tagging.js';
import { logger } from '../config/logger.js';
import pLimit from 'p-limit';

const log = logger.child({ service: 'user-pipeline' });

// Global concurrency: max 3 user pipelines simultaneously
// Prevents VPS overload when many users open the app at once
// Beyond this, requests queue (not rejected) — users still get served, just slower
const pipelineLimiter = pLimit(3);

// Track active pipelines to prevent duplicate runs for same user
const activePipelines = new Set<string>();

/**
 * Run the full content pipeline for a user after sync:
 *   1. Transcribe new content (platform-specific)
 *   2. Generate quizzes for transcribed content
 *   3. Auto-tag content with quizzes
 *
 * Designed to be called fire-and-forget after sync.
 * Safe to call concurrently — uses global limiter + per-user dedup.
 * Idempotent — re-running is harmless (skips already-processed content).
 */
export async function runUserPipeline(userId: string): Promise<void> {
  // Skip if already running for this user
  if (activePipelines.has(userId)) {
    log.debug({ userId }, 'Pipeline already running for user, skipping');
    return;
  }

  return pipelineLimiter(async () => {
    activePipelines.add(userId);
    const startTime = Date.now();

    try {
      // Phase 1: Transcribe untranscribed content
      const transcribed = await transcribeUserContent(userId);

      // Phase 2: Generate quizzes for content that has transcripts but no quiz
      const quizzed = await generateUserQuizzes(userId);

      // Phase 3: Auto-tag content that is READY but has no tags
      const tagged = await tagUserContent(userId);

      const elapsed = Date.now() - startTime;

      // Only log if we actually did work
      if (transcribed > 0 || quizzed > 0 || tagged > 0) {
        log.info(
          { userId, transcribed, quizzed, tagged, elapsedMs: elapsed },
          'User pipeline completed'
        );
      } else {
        log.debug({ userId, elapsedMs: elapsed }, 'User pipeline — nothing to process');
      }
    } catch (error) {
      log.error({ err: error, userId }, 'User pipeline failed');
    } finally {
      activePipelines.delete(userId);
    }
  });
}

// ---------------------------------------------------------------------------
// Phase 1: Transcription
// ---------------------------------------------------------------------------

async function transcribeUserContent(userId: string): Promise<number> {
  const pending = await prisma.content.findMany({
    where: {
      userId,
      transcript: null,
      transcriptionFailed: false,
      status: { in: ['INBOX', 'SELECTED'] },
    },
    select: { id: true, platform: true },
    take: 20, // Cap per pipeline run to avoid hogging resources
    orderBy: { createdAt: 'asc' },
  });

  if (pending.length === 0) return 0;

  log.info({ userId, count: pending.length }, 'Pipeline: transcribing');

  // 3 concurrent transcriptions per user
  // The global groqLimiter (3 concurrent Whisper calls) acts as a second gate
  const limit = pLimit(3);
  let success = 0;

  await Promise.allSettled(
    pending.map((content) =>
      limit(async () => {
        const ok = await transcribeByPlatform(content.id, content.platform);
        if (ok) success++;
      })
    )
  );

  return success;
}

async function transcribeByPlatform(
  contentId: string,
  platform: Platform
): Promise<boolean> {
  try {
    switch (platform) {
      case Platform.YOUTUBE:
        return await processContentTranscript(contentId);
      case Platform.TIKTOK:
        return await processTikTokTranscript(contentId);
      case Platform.INSTAGRAM:
        return await processInstagramTranscript(contentId);
      case Platform.SPOTIFY:
        return await processPodcastTranscript(contentId);
      default:
        return false;
    }
  } catch (error) {
    log.error({ err: error, contentId, platform }, 'Pipeline transcription failed');
    return false;
  }
}

// ---------------------------------------------------------------------------
// Phase 2: Quiz generation
// ---------------------------------------------------------------------------

async function generateUserQuizzes(userId: string): Promise<number> {
  const pending = await prisma.content.findMany({
    where: {
      userId,
      transcript: { isNot: null },
      quizzes: { none: {} },
      status: 'SELECTED',
    },
    select: { id: true },
    take: 10, // Quiz gen is expensive (~3 LLM calls each)
    orderBy: { createdAt: 'asc' },
  });

  if (pending.length === 0) return 0;

  log.info({ userId, count: pending.length }, 'Pipeline: generating quizzes');

  // 2 concurrent quiz generations per user
  // The global llmLimiter (5 concurrent) acts as a second gate
  const limit = pLimit(2);
  let success = 0;

  await Promise.allSettled(
    pending.map((content) =>
      limit(async () => {
        try {
          const ok = await processContentQuiz(content.id);
          if (ok) success++;
        } catch (error) {
          log.error({ err: error, contentId: content.id }, 'Pipeline quiz generation failed');
        }
      })
    )
  );

  return success;
}

// ---------------------------------------------------------------------------
// Phase 3: Auto-tagging
// ---------------------------------------------------------------------------

async function tagUserContent(userId: string): Promise<number> {
  const pending = await prisma.content.findMany({
    where: {
      userId,
      transcript: { isNot: null },
      tags: { none: {} },
      status: 'READY',
    },
    select: { id: true },
    take: 10,
    orderBy: { createdAt: 'asc' },
  });

  if (pending.length === 0) return 0;

  log.info({ userId, count: pending.length }, 'Pipeline: auto-tagging');

  const limit = pLimit(3);
  let success = 0;

  await Promise.allSettled(
    pending.map((content) =>
      limit(async () => {
        try {
          const tags = await autoTagContent(content.id);
          if (tags.length > 0) success++;
        } catch (error) {
          log.error({ err: error, contentId: content.id }, 'Pipeline auto-tagging failed');
        }
      })
    )
  );

  return success;
}
