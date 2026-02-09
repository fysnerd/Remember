// Transcript Cache Service - Global cache shared across users
// Eliminates redundant transcription calls for the same content
import { prisma } from '../config/database.js';
import { Platform, TranscriptCacheStatus, TranscriptSource } from '@prisma/client';
import { randomBytes } from 'crypto';

// Lock timeout in milliseconds (5 minutes)
const LOCK_TIMEOUT_MS = 5 * 60 * 1000;

// Retry delays
const RETRY_UNAVAILABLE_DAYS = 7; // Retry after 7 days if no subtitles
const RETRY_FAILED_HOURS = [1, 6, 24]; // Exponential backoff for transient errors
const MAX_RETRY_ATTEMPTS = 5; // After this many failures, mark as UNAVAILABLE permanently

interface TranscriptData {
  text: string;
  segments: any[];
  language: string;
  source: TranscriptSource;
}

interface CacheResult {
  cache: {
    id: string;
    status: TranscriptCacheStatus;
    text: string | null;
    segments: any;
    language: string | null;
    source: TranscriptSource | null;
    attemptCount: number;
    nextRetryAt: Date | null;
  };
  acquired: boolean; // True if we acquired the lock
}

/**
 * Generate a unique worker ID
 */
export function generateWorkerId(): string {
  return `worker_${randomBytes(8).toString('hex')}`;
}

/**
 * Get or create a cache entry with optional lock acquisition
 * Returns null if the cache is locked by another worker
 */
export async function getOrCreateCacheWithLock(
  platform: Platform,
  externalId: string,
  workerId: string
): Promise<CacheResult | null> {
  const now = new Date();
  const lockExpiry = new Date(now.getTime() - LOCK_TIMEOUT_MS);

  // Try to find existing cache
  let cache = await prisma.transcriptCache.findUnique({
    where: {
      platform_externalId: { platform, externalId },
    },
  });

  // If cache exists and is SUCCESS, return it immediately (no lock needed)
  if (cache && cache.status === TranscriptCacheStatus.SUCCESS) {
    return { cache, acquired: false };
  }

  // If cache exists and is UNAVAILABLE, check if we should retry
  if (cache && cache.status === TranscriptCacheStatus.UNAVAILABLE) {
    if (!shouldRetry(cache.nextRetryAt)) {
      return { cache, acquired: false };
    }
    // Fall through to try acquiring lock for retry
  }

  // If cache exists and is FAILED, check if we should retry (respect backoff)
  if (cache && cache.status === TranscriptCacheStatus.FAILED) {
    if (!shouldRetry(cache.nextRetryAt)) {
      return { cache, acquired: false };
    }
    // Fall through to try acquiring lock for retry
  }

  // If cache exists and is PROCESSING, check if lock is expired
  if (cache && cache.status === TranscriptCacheStatus.PROCESSING) {
    if (cache.lockedAt && cache.lockedAt > lockExpiry) {
      // Still locked by another worker
      console.log(`[TranscriptCache] ${externalId} locked by ${cache.lockedBy}, skipping`);
      return null;
    }
    // Lock expired, we can steal it
  }

  // Try to acquire lock via upsert + atomic update
  try {
    if (!cache) {
      // Create new cache entry with lock
      cache = await prisma.transcriptCache.create({
        data: {
          platform,
          externalId,
          status: TranscriptCacheStatus.PROCESSING,
          lockedBy: workerId,
          lockedAt: now,
        },
      });
      console.log(`[TranscriptCache] Created new cache for ${externalId}`);
      return { cache, acquired: true };
    }

    // Try to acquire lock on existing entry
    const updated = await prisma.transcriptCache.updateMany({
      where: {
        id: cache.id,
        OR: [
          { lockedBy: null },
          { lockedAt: { lt: lockExpiry } },
          { status: TranscriptCacheStatus.PENDING },
          // Allow retry of FAILED only if nextRetryAt has passed (respect backoff)
          {
            status: TranscriptCacheStatus.FAILED,
            nextRetryAt: { lt: now },
          },
          // Allow retry of UNAVAILABLE if nextRetryAt has passed
          {
            status: TranscriptCacheStatus.UNAVAILABLE,
            nextRetryAt: { lt: now },
          },
        ],
      },
      data: {
        lockedBy: workerId,
        lockedAt: now,
        status: TranscriptCacheStatus.PROCESSING,
      },
    });

    if (updated.count === 0) {
      console.log(`[TranscriptCache] Failed to acquire lock for ${externalId}`);
      return null;
    }

    // Fetch updated cache
    cache = await prisma.transcriptCache.findUnique({
      where: { id: cache.id },
    });

    if (!cache) return null;

    console.log(`[TranscriptCache] Acquired lock for ${externalId}`);
    return { cache, acquired: true };

  } catch (error: any) {
    // Handle unique constraint violation (race condition on create)
    if (error.code === 'P2002') {
      console.log(`[TranscriptCache] Race condition on create for ${externalId}, retrying...`);
      // Retry with existing record
      return getOrCreateCacheWithLock(platform, externalId, workerId);
    }
    throw error;
  }
}

/**
 * Check if a cache entry should be retried
 */
function shouldRetry(nextRetryAt: Date | null): boolean {
  if (!nextRetryAt) return false;
  return new Date() >= nextRetryAt;
}

/**
 * Mark cache as SUCCESS and store transcript data
 */
export async function markCacheSuccess(
  cacheId: string,
  data: TranscriptData,
  _workerId: string
): Promise<void> {
  await prisma.transcriptCache.update({
    where: { id: cacheId },
    data: {
      status: TranscriptCacheStatus.SUCCESS,
      text: data.text,
      segments: data.segments,
      language: data.language,
      source: data.source,
      lockedBy: null,
      lockedAt: null,
      lastAttemptAt: new Date(),
    },
  });
  console.log(`[TranscriptCache] Marked ${cacheId} as SUCCESS`);
}

/**
 * Mark cache as UNAVAILABLE (no subtitles available)
 * Will retry after RETRY_UNAVAILABLE_DAYS
 */
export async function markCacheUnavailable(
  cacheId: string,
  reason: string,
  _workerId: string
): Promise<void> {
  const nextRetry = new Date();
  nextRetry.setDate(nextRetry.getDate() + RETRY_UNAVAILABLE_DAYS);

  await prisma.transcriptCache.update({
    where: { id: cacheId },
    data: {
      status: TranscriptCacheStatus.UNAVAILABLE,
      failureReason: reason,
      lockedBy: null,
      lockedAt: null,
      lastAttemptAt: new Date(),
      nextRetryAt: nextRetry,
      attemptCount: { increment: 1 },
    },
  });
  console.log(`[TranscriptCache] Marked ${cacheId} as UNAVAILABLE, retry at ${nextRetry.toISOString()}`);
}

/**
 * Mark cache as FAILED (transient error)
 * Will retry with exponential backoff
 */
export async function markCacheFailed(
  cacheId: string,
  error: Error | string,
  _workerId: string
): Promise<void> {
  // Get current attempt count
  const cache = await prisma.transcriptCache.findUnique({
    where: { id: cacheId },
    select: { attemptCount: true },
  });

  const attemptCount = (cache?.attemptCount || 0) + 1;
  const errorMessage = error instanceof Error ? error.message : String(error);

  // After MAX_RETRY_ATTEMPTS, give up and mark as UNAVAILABLE permanently
  if (attemptCount >= MAX_RETRY_ATTEMPTS) {
    console.log(`[TranscriptCache] ${cacheId} exceeded max retries (${attemptCount}/${MAX_RETRY_ATTEMPTS}), marking UNAVAILABLE`);
    await markCacheUnavailable(cacheId, `Max retries exceeded (${attemptCount}): ${errorMessage.substring(0, 300)}`, _workerId);
    return;
  }

  const retryIndex = Math.min(attemptCount - 1, RETRY_FAILED_HOURS.length - 1);
  const retryHours = RETRY_FAILED_HOURS[retryIndex];

  const nextRetry = new Date();
  nextRetry.setHours(nextRetry.getHours() + retryHours);

  await prisma.transcriptCache.update({
    where: { id: cacheId },
    data: {
      status: TranscriptCacheStatus.FAILED,
      failureReason: errorMessage.substring(0, 500),
      lockedBy: null,
      lockedAt: null,
      lastAttemptAt: new Date(),
      nextRetryAt: nextRetry,
      attemptCount,
    },
  });
  console.log(`[TranscriptCache] Marked ${cacheId} as FAILED (attempt ${attemptCount}/${MAX_RETRY_ATTEMPTS}), retry at ${nextRetry.toISOString()}`);
}

/**
 * Release lock without changing status (for early exits)
 */
export async function releaseLock(cacheId: string, workerId: string): Promise<void> {
  await prisma.transcriptCache.updateMany({
    where: {
      id: cacheId,
      lockedBy: workerId,
    },
    data: {
      lockedBy: null,
      lockedAt: null,
    },
  });
}

/**
 * Link all Content records for this externalId to the cache
 */
export async function linkCacheToContent(
  platform: Platform,
  externalId: string,
  cacheId: string
): Promise<number> {
  const result = await prisma.content.updateMany({
    where: {
      platform,
      externalId,
      transcriptCacheId: null, // Only update if not already linked
    },
    data: {
      transcriptCacheId: cacheId,
    },
  });

  if (result.count > 0) {
    console.log(`[TranscriptCache] Linked ${result.count} Content records to cache ${cacheId}`);
  }

  return result.count;
}

/**
 * Copy transcript from cache to Content's Transcript table
 * This maintains backward compatibility with existing quiz generation
 */
export async function copyTranscriptFromCache(
  contentId: string,
  cache: {
    text: string | null;
    segments: any;
    language: string | null;
    source: TranscriptSource | null;
  }
): Promise<boolean> {
  if (!cache.text || !cache.source) {
    return false;
  }

  // Check if transcript already exists
  const existing = await prisma.transcript.findUnique({
    where: { contentId },
  });

  if (existing) {
    return true; // Already has transcript
  }

  await prisma.transcript.create({
    data: {
      contentId,
      text: cache.text,
      segments: cache.segments,
      language: cache.language || 'en',
      source: cache.source,
    },
  });

  return true;
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  total: number;
  byStatus: Record<TranscriptCacheStatus, number>;
  byPlatform: Record<Platform, number>;
}> {
  const [total, byStatus, byPlatform] = await Promise.all([
    prisma.transcriptCache.count(),
    prisma.transcriptCache.groupBy({
      by: ['status'],
      _count: true,
    }),
    prisma.transcriptCache.groupBy({
      by: ['platform'],
      _count: true,
    }),
  ]);

  return {
    total,
    byStatus: byStatus.reduce((acc, item) => {
      acc[item.status] = item._count;
      return acc;
    }, {} as Record<TranscriptCacheStatus, number>),
    byPlatform: byPlatform.reduce((acc, item) => {
      acc[item.platform] = item._count;
      return acc;
    }, {} as Record<Platform, number>),
  };
}

/**
 * Clean up expired locks (maintenance task)
 */
export async function cleanupExpiredLocks(): Promise<number> {
  const lockExpiry = new Date(Date.now() - LOCK_TIMEOUT_MS);

  const result = await prisma.transcriptCache.updateMany({
    where: {
      status: TranscriptCacheStatus.PROCESSING,
      lockedAt: { lt: lockExpiry },
    },
    data: {
      status: TranscriptCacheStatus.PENDING,
      lockedBy: null,
      lockedAt: null,
    },
  });

  if (result.count > 0) {
    console.log(`[TranscriptCache] Cleaned up ${result.count} expired locks`);
  }

  return result.count;
}
