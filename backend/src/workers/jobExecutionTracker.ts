// Job Execution Tracker - Persists cron job execution history to database
import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';
import { broadcastJobEvent } from '../admin/dashboard.sse.js';

const log = logger.child({ component: 'job-tracker' });

/**
 * Wraps a job function with database execution tracking.
 * Creates a RUNNING record at start, updates to SUCCESS/FAILED on completion.
 * Tracking failures are logged but never block or crash the job.
 */
export async function trackJobExecution(
  jobName: string,
  job: () => Promise<void>,
  triggerSource: 'SCHEDULED' | 'MANUAL' = 'SCHEDULED'
): Promise<void> {
  const startTime = Date.now();
  let executionId: string | null = null;

  // Create execution record at start (non-blocking on failure)
  try {
    const execution = await prisma.jobExecution.create({
      data: {
        jobName,
        status: 'RUNNING',
        triggerSource,
      },
    });
    executionId = execution.id;
    try {
      broadcastJobEvent({ type: 'job_started', jobName, status: 'RUNNING', triggerSource });
    } catch { /* SSE broadcast failure must never affect job execution */ }
  } catch (createError) {
    log.error({ err: createError, job: jobName }, 'Failed to create job execution record - job will still run');
  }

  try {
    // Run the actual job
    await job();

    // Update to SUCCESS
    const duration = Date.now() - startTime;
    if (executionId) {
      try {
        await prisma.jobExecution.update({
          where: { id: executionId },
          data: {
            status: 'SUCCESS',
            completedAt: new Date(),
            duration,
          },
        });
        try {
          broadcastJobEvent({ type: 'job_completed', jobName, status: 'SUCCESS', triggerSource, duration });
        } catch { /* SSE broadcast failure must never affect job execution */ }
      } catch (updateError) {
        log.error({ err: updateError, executionId, job: jobName }, 'Failed to update job execution to SUCCESS');
      }
    }
  } catch (error) {
    // Update to FAILED with error details
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    if (executionId) {
      try {
        await prisma.jobExecution.update({
          where: { id: executionId },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            duration,
            error: errorMessage,
            errorStack: errorStack ?? null,
          },
        });
        try {
          broadcastJobEvent({ type: 'job_failed', jobName, status: 'FAILED', triggerSource, duration, error: errorMessage });
        } catch { /* SSE broadcast failure must never affect job execution */ }
      } catch (updateError) {
        log.error({ err: updateError, executionId, job: jobName }, 'Failed to update job execution to FAILED');
      }
    }

    // Re-throw to preserve existing error handling in runJob()
    throw error;
  }
}
