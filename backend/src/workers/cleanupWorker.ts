// Cleanup Worker - Deletes old job execution records to prevent table growth
import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';

const log = logger.child({ component: 'cleanup-worker' });

const RETENTION_DAYS = 30;
const BATCH_SIZE = 500;
const BATCH_DELAY_MS = 100;

/**
 * Deletes job execution records older than RETENTION_DAYS.
 * Uses batched deletion to avoid database table locks.
 */
export async function runCleanupJobExecutions(): Promise<void> {
  log.info({ retentionDays: RETENTION_DAYS }, 'Starting job execution cleanup');

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

  let totalDeleted = 0;
  let hasMore = true;

  while (hasMore) {
    const toDelete = await prisma.jobExecution.findMany({
      where: {
        startedAt: { lt: cutoffDate },
      },
      select: { id: true },
      take: BATCH_SIZE,
    });

    if (toDelete.length === 0) {
      hasMore = false;
      break;
    }

    const ids = toDelete.map(record => record.id);
    const result = await prisma.jobExecution.deleteMany({
      where: { id: { in: ids } },
    });

    totalDeleted += result.count;
    log.debug({ batchDeleted: result.count, totalDeleted }, 'Cleanup batch completed');

    // Small delay between batches to avoid overwhelming database
    if (toDelete.length === BATCH_SIZE) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    } else {
      hasMore = false;
    }
  }

  log.info({ totalDeleted, retentionDays: RETENTION_DAYS }, 'Job execution cleanup completed');
}
