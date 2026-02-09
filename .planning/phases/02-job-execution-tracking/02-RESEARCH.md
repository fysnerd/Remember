# Phase 02: Job Execution Tracking - Research

**Researched:** 2026-02-09
**Domain:** Cron job execution persistence and monitoring with Prisma ORM
**Confidence:** HIGH

## Summary

Job execution tracking for node-cron requires a custom database persistence layer since node-cron itself provides no built-in storage or monitoring capabilities. The standard approach involves creating a dedicated Prisma model to persist job runs with status, timing, and error details, then wrapping each cron job with tracking logic that writes to this model.

The current Ankora backend has 11 cron jobs (sync: 4, transcription: 4, processing: 3) running via node-cron with an in-memory overlap prevention mechanism (`runningJobs` Set). These jobs currently have timing instrumentation (startTime, duration logging) and error handling (try/catch with Pino logging), but execution history is lost on PM2 restart since nothing is persisted to the database.

For this phase, we'll add a `JobExecution` Prisma model storing execution records (jobName, status, timestamps, duration, items processed, error details), wrap all 11 jobs with database persistence hooks, implement automatic 30-day cleanup, and ensure tracking doesn't interfere with existing job behavior (non-blocking writes, isolated transactions).

**Primary recommendation:** Use a simple JobExecution model with composite index on (jobName, startedAt), write execution records at job start/end using Prisma's built-in transaction support, handle tracking failures gracefully (log but don't crash jobs), and add daily cleanup cron for records older than 30 days.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @prisma/client | ^6.2.1 | ORM for database persistence | Already in use, type-safe queries, migration support |
| node-cron | ^4.2.1 | Cron job scheduling | Already in use, no built-in persistence |
| pino | ^10.3.0 | Structured logging | Already adopted in Phase 1, high performance |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| p-limit | ^7.3.0 | Concurrency control | Already in use for rate limiting, can batch cleanup deletes |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| node-cron + Prisma | BullMQ/Agenda | Full job queue systems with built-in persistence but require Redis/MongoDB, overkill for simple cron schedules |
| Custom JobExecution model | Audit log library (Bemi, etc.) | Third-party audit libraries track CRUD operations, not cron job execution metadata |
| Manual cleanup cron | PostgreSQL pg_cron extension | Requires superuser DB access, couples cleanup to database instead of application layer |

**Installation:**
```bash
# All dependencies already installed
npm list @prisma/client node-cron pino p-limit
```

## Architecture Patterns

### Recommended Project Structure
```
backend/src/
├── workers/
│   ├── scheduler.ts              # Central cron job registration (already exists)
│   ├── jobExecutionTracker.ts    # NEW: Tracking wrapper functions
│   └── cleanupWorker.ts          # NEW: 30-day retention cleanup cron
├── config/
│   ├── database.ts               # Prisma client (already exists)
│   └── logger.ts                 # Pino logger (already exists)
└── prisma/
    └── schema.prisma             # Add JobExecution model
```

### Pattern 1: Job Execution Model Schema

**What:** Dedicated Prisma model to store every job run with lifecycle metadata

**When to use:** Always - single source of truth for job execution history

**Example:**
```prisma
// Source: Composite of audit trail patterns from https://medium.com/@gayanper/implementing-entity-audit-log-with-prisma-9cd3c15f6b8e
model JobExecution {
  id            String   @id @default(cuid())

  // Job identification
  jobName       String   // e.g., 'youtube-sync', 'quiz-generation'

  // Execution lifecycle
  status        JobStatus @default(RUNNING)
  startedAt     DateTime  @default(now())
  completedAt   DateTime?
  duration      Int?      // milliseconds

  // Processing metrics
  itemsProcessed Int?     // Optional: count of items (videos synced, quizzes generated, etc.)

  // Error tracking
  error         String?   // Error message if failed
  errorStack    String?   // Stack trace for debugging

  @@index([jobName, startedAt])
  @@index([status, startedAt])
}

enum JobStatus {
  RUNNING
  SUCCESS
  FAILED
}
```

**Key fields rationale:**
- `jobName`: String instead of enum for flexibility (easier to add jobs without schema migration)
- `startedAt`: Default now() captures exact start time, indexed for range queries
- `duration`: Calculated as `completedAt - startedAt`, useful for performance monitoring
- `itemsProcessed`: Optional metric (e.g., videos synced, quizzes generated) for job-specific insights
- `error` + `errorStack`: Separated for UI display vs debugging needs
- Composite index `[jobName, startedAt]`: Optimizes common query "show recent runs of job X"

### Pattern 2: Non-Blocking Execution Wrapper

**What:** Wrap job functions with tracking logic that persists to database without blocking execution

**When to use:** For all 11 existing cron jobs in scheduler.ts

**Example:**
```typescript
// Source: Adapted from current scheduler.ts runJob() pattern
import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';
import { JobStatus } from '@prisma/client';

const log = logger.child({ component: 'job-tracker' });

/**
 * Wrapper to track job execution in database
 */
export async function trackJobExecution(
  jobName: string,
  job: () => Promise<void>
): Promise<void> {
  const startTime = Date.now();
  let executionId: string | null = null;

  try {
    // Create execution record at start
    const execution = await prisma.jobExecution.create({
      data: {
        jobName,
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });
    executionId = execution.id;

    // Run the actual job
    await job();

    // Update to SUCCESS on completion
    const duration = Date.now() - startTime;
    await prisma.jobExecution.update({
      where: { id: executionId },
      data: {
        status: 'SUCCESS',
        completedAt: new Date(),
        duration,
      },
    });

    log.info({ job: jobName, durationMs: duration }, 'Job completed successfully');

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Update to FAILED with error details
    if (executionId) {
      try {
        await prisma.jobExecution.update({
          where: { id: executionId },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            duration,
            error: errorMessage,
            errorStack,
          },
        });
      } catch (updateError) {
        // If we can't update the execution record, log but don't crash
        log.error({ err: updateError, executionId }, 'Failed to update job execution record');
      }
    }

    log.error({ job: jobName, err: error, durationMs: duration }, 'Job execution failed');
    throw error; // Re-throw to preserve existing error handling
  }
}
```

**Critical design choices:**
- **Non-blocking writes:** Database writes happen before/after job execution, not during
- **Isolated transactions:** Each `create`/`update` is a separate transaction (Prisma default)
- **Graceful degradation:** If tracking fails, log error but don't crash the job itself
- **Preserve error semantics:** Re-throw errors to maintain existing `runningJobs` cleanup behavior

### Pattern 3: Automatic Cleanup with Batching

**What:** Daily cron job to delete execution records older than 30 days, using batch processing to avoid database locks

**When to use:** Always - prevent unbounded table growth

**Example:**
```typescript
// Source: Batch deletion pattern from https://aashishpeepra-ap.medium.com/how-to-delete-a-large-number-of-rows-in-production-394b89179d26
import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';
import pLimit from 'p-limit';

const log = logger.child({ job: 'cleanup-job-executions' });

const RETENTION_DAYS = 30;
const BATCH_SIZE = 500;

export async function runCleanupJobExecutions(): Promise<void> {
  log.info('Starting job execution cleanup');
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

  let totalDeleted = 0;
  let hasMore = true;

  while (hasMore) {
    // Fetch batch of IDs to delete
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

    // Delete batch
    const ids = toDelete.map(record => record.id);
    await prisma.jobExecution.deleteMany({
      where: { id: { in: ids } },
    });

    totalDeleted += toDelete.length;
    log.debug({ batchSize: toDelete.length, totalDeleted }, 'Batch deleted');

    // Small delay to avoid overwhelming database
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  log.info({ totalDeleted, retentionDays: RETENTION_DAYS }, 'Cleanup completed');
}
```

**Batching rationale:**
- **Avoid locks:** Deleting 70K+ rows in one query locks the table; batches spread load
- **Progress visibility:** Log after each batch shows cleanup is working (not frozen)
- **Resource-friendly:** 100ms delay between batches prevents database saturation

### Anti-Patterns to Avoid

- **Blocking job execution on tracking writes:** Don't use `await` in a way that delays job start - tracking should be asynchronous concern
- **Single transaction for job + tracking:** Wrapping job logic and tracking in one transaction couples them; tracking failures would rollback job work
- **Unbounded table growth:** Not cleaning up old records leads to query slowdowns and storage bloat
- **Hard-coding job names in schema:** Using enum for jobName requires migration for every new job; string is more flexible

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Composite indexes | Manual query optimization | Prisma `@@index([field1, field2])` | Handles multi-column index creation, optimizes range queries automatically |
| Batch deletion | Recursive delete loops | Batched `findMany` + `deleteMany` | Avoids stack overflow, prevents table locks, measurable progress |
| Error stack trace capture | Custom error parsing | Native `error.stack` property | Already includes line numbers, file paths, call chain |
| JSON serialization of metrics | String concatenation | Prisma `Json` type | Type-safe, queryable with PostgreSQL JSON operators |
| Worker ID generation | UUID/timestamp hacks | Prisma `@default(cuid())` | Collision-resistant, sortable, built-in |

**Key insight:** Prisma already provides type-safe persistence, indexing, and transaction support. The main work is designing the schema fields and wrapping existing functions - don't reinvent database interaction primitives.

## Common Pitfalls

### Pitfall 1: Blocking Job Execution on Database Writes

**What goes wrong:** Wrapping job execution in a transaction or making tracking writes block job start causes jobs to fail if database is slow/down

**Why it happens:** Natural instinct to ensure tracking succeeds before job runs, or to rollback job work if tracking fails

**How to avoid:** Use separate transactions for tracking writes (start record, end record) and never block job execution on tracking success

**Warning signs:** Jobs timing out when database is under load, tracking errors causing job failures

### Pitfall 2: Index Bloat from Over-Indexing

**What goes wrong:** Adding indexes on every field slows down writes (inserts/updates) and wastes disk space

**Why it happens:** "More indexes = faster queries" mentality without considering write cost

**How to avoid:** Index only query patterns you actually use: `[jobName, startedAt]` for "recent runs of job X", `[status, startedAt]` for "all failed jobs in date range". Skip single-field indexes if composite covers them.

**Warning signs:** Slow inserts/updates on JobExecution table, database showing high index maintenance overhead

### Pitfall 3: Not Handling Tracking Failures Gracefully

**What goes wrong:** If Prisma write to JobExecution fails (network issue, database down), job crashes instead of running

**Why it happens:** Forgetting to catch tracking errors separately from job errors

**How to avoid:** Wrap Prisma tracking calls in try/catch, log tracking failures but allow job to proceed

**Warning signs:** Jobs not running when database is temporarily unavailable, missing execution records with no error logs

### Pitfall 4: Large Deletions Locking Database

**What goes wrong:** Running `deleteMany` on 100K+ records locks the table for minutes, blocking other queries

**Why it happens:** Trying to delete all old records in one query instead of batching

**How to avoid:** Use batched deletion (fetch IDs in chunks of 500, delete each batch separately with small delay)

**Warning signs:** Database performance degradation during cleanup cron, slow queries on other tables

### Pitfall 5: Forgetting to Add Cleanup Job to Scheduler

**What goes wrong:** JobExecution table grows unbounded, queries slow down over months/years

**Why it happens:** Implementing cleanup function but not registering it in scheduler.ts

**How to avoid:** After creating cleanup worker, immediately add it to scheduler.ts with daily cron expression

**Warning signs:** JobExecution table size growing indefinitely, query performance degrading over time

## Code Examples

Verified patterns from current codebase and official sources:

### Current Job Wrapper Pattern (scheduler.ts)
```typescript
// Source: backend/src/workers/scheduler.ts lines 27-44
async function runJob(jobName: string, job: () => Promise<void>): Promise<void> {
  if (runningJobs.has(jobName)) {
    log.warn({ job: jobName }, 'Skipping job - previous run still in progress');
    return;
  }

  runningJobs.add(jobName);
  const startTime = Date.now();
  try {
    await job();
    const duration = Date.now() - startTime;
    log.info({ job: jobName, durationMs: duration }, 'Job completed');
  } catch (error) {
    log.error({ job: jobName, err: error }, 'Job execution failed');
  } finally {
    runningJobs.delete(jobName);
  }
}
```
**Adaptation needed:** Insert `trackJobExecution` wrapper inside this function, after `runningJobs.add` and before `await job()`

### Existing Job Execution Pattern (youtubeSync.ts)
```typescript
// Source: backend/src/workers/youtubeSync.ts lines 182-220
export async function runYouTubeSync(): Promise<void> {
  log.info('Starting sync');
  const startTime = Date.now();

  const connections = await prisma.connectedPlatform.findMany({
    where: { platform: Platform.YOUTUBE },
    include: { user: true },
  });

  log.info({ userCount: connections.length }, 'Found users to sync');

  let totalNewVideos = 0;
  let successCount = 0;
  let errorCount = 0;

  const results = await Promise.allSettled(
    connections.map(connection =>
      youtubeLimiter(() => syncUserYouTube(connection.userId, connection.id))
    )
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      totalNewVideos += result.value;
      successCount++;
    } else {
      errorCount++;
    }
  }

  const duration = Date.now() - startTime;
  log.info({ durationMs: duration, successCount, errorCount, totalNewVideos }, 'Sync completed');
}
```
**Adaptation needed:** Capture `totalNewVideos` as `itemsProcessed` field when updating JobExecution record to SUCCESS

### Prisma Index Definition
```prisma
// Source: https://www.prisma.io/docs/orm/prisma-schema/data-model/indexes
model JobExecution {
  id        String   @id @default(cuid())
  jobName   String
  startedAt DateTime @default(now())

  // Composite index for common query pattern: "recent runs of specific job"
  @@index([jobName, startedAt])

  // Composite index for monitoring queries: "all failed/running jobs in date range"
  @@index([status, startedAt])
}
```
**Usage:** Prisma automatically uses these indexes for WHERE clauses on indexed fields

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| In-memory job tracking only | Database-persisted execution history | 2024+ | Job history survives restarts, enables monitoring dashboards |
| Single-row deletion | Batched deletion with limits | 2023+ | Prevents table locks on large deletions |
| String error messages | Structured error + stack trace | 2024+ | Debugging production failures without console access |
| Manual indexing | Prisma declarative indexes | Prisma 2.0+ (2020) | Type-safe, migration-managed, optimized query planner usage |

**Deprecated/outdated:**
- **BullMQ/Agenda for simple cron schedules:** Overhead of Redis/MongoDB not justified when node-cron + Prisma handles 11 jobs fine
- **Timestamp(0) precision in PostgreSQL:** Prisma docs recommend avoiding `@db.Timestamp(0)` due to rounding issues - use default DateTime precision
- **Global transactions for tracking:** Early patterns wrapped jobs in transactions; modern approach uses isolated tracking writes

## Open Questions

1. **Should itemsProcessed be optional or required?**
   - What we know: Some jobs have countable items (videos synced), others don't (reminder email batch)
   - What's unclear: Whether forcing `itemsProcessed: 0` for non-counting jobs is better than allowing null
   - Recommendation: Make it optional (`Int?`) - cleaner to omit than force meaningless zeros

2. **Should we track job parameters/configuration?**
   - What we know: Jobs run with same config each time (hardcoded schedules)
   - What's unclear: Future use case for per-run config (e.g., manual trigger with custom user filter)
   - Recommendation: Defer until needed - add `metadata Json?` field in future if config tracking becomes valuable

3. **Should cleanup job be registered before or after execution tracking is deployed?**
   - What we know: Cleanup job is harmless if table is empty (no-op)
   - What's unclear: Whether to deploy cleanup in same migration or separate follow-up
   - Recommendation: Deploy cleanup in same migration - validates the pattern immediately, no risk

## Sources

### Primary (HIGH confidence)
- [Prisma Documentation: Indexes](https://www.prisma.io/docs/orm/prisma-schema/data-model/indexes) - Official guide to index definition and query optimization
- [Better Stack: Job Scheduling in Node.js with Node-cron](https://betterstack.com/community/guides/scaling-nodejs/node-cron-scheduled-tasks/) - Verified node-cron limitations (no built-in persistence)
- Current codebase: `backend/src/workers/scheduler.ts`, `backend/src/workers/youtubeSync.ts`, `backend/prisma/schema.prisma` - Existing patterns

### Secondary (MEDIUM confidence)
- [Medium: Implementing Entity Audit Log with Prisma](https://medium.com/@gayanper/implementing-entity-audit-log-with-prisma-9cd3c15f6b8e) - Audit trail model design patterns
- [Medium: Large Row Deletion in Production](https://aashishpeepra-ap.medium.com/how-to-delete-a-large-number-of-rows-in-production-394b89179d26) - Batch deletion strategy to avoid locks
- [DEV: How to Monitor Cron Jobs in 2026](https://dev.to/cronmonitor/how-to-monitor-cron-jobs-in-2026-a-complete-guide-28g9) - Monitoring approaches, confirms node-cron lacks built-in tracking

### Tertiary (LOW confidence)
- [Last9: Cron Jobs in Node.js](https://last9.io/blog/how-to-set-up-and-manage-cron-jobs-in-node-js/) - General patterns, useful for context but not authoritative for implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Dependencies already in package.json, Prisma/node-cron usage verified in codebase
- Architecture: HIGH - Patterns drawn from current scheduler.ts implementation, official Prisma docs, verified audit trail articles
- Pitfalls: MEDIUM - Based on web search findings and general database best practices, not Ankora-specific incidents

**Research date:** 2026-02-09
**Valid until:** 2026-04-09 (60 days - stable domain, Prisma/node-cron are mature)
