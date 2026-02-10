import type { Request, Response } from 'express';
import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';

const log = logger.child({ component: 'jobs-handler' });

interface StatsRow {
  jobName: string;
  total: number;
  successes: number;
  failures: number;
  avg_duration: number | null;
  min_duration: number | null;
  max_duration: number | null;
  last_run: Date | null;
}

/**
 * GET /admin/api/jobs
 *
 * Query params:
 *   - job:    filter by jobName (e.g. "instagram-sync")
 *   - range:  time range in hours (default 72 = 3 days)
 *   - limit:  max executions per job (default 50)
 */
export async function jobsHandler(req: Request, res: Response) {
  const jobFilter = req.query.job as string | undefined;
  const rangeHours = Math.min(Number(req.query.range) || 72, 720); // max 30 days
  const limit = Math.min(Number(req.query.limit) || 50, 200);

  const since = new Date(Date.now() - rangeHours * 60 * 60 * 1000);

  try {
    // Aggregated stats per job
    const statsRaw: StatsRow[] = jobFilter
      ? await prisma.$queryRaw`
          SELECT
            "jobName",
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'SUCCESS')::int AS successes,
            COUNT(*) FILTER (WHERE status = 'FAILED')::int AS failures,
            ROUND(AVG(duration))::int AS avg_duration,
            MIN(duration)::int AS min_duration,
            MAX(duration)::int AS max_duration,
            MAX("startedAt") AS last_run
          FROM job_executions
          WHERE "startedAt" >= ${since} AND "jobName" = ${jobFilter}
          GROUP BY "jobName"
          ORDER BY "jobName"
        `
      : await prisma.$queryRaw`
          SELECT
            "jobName",
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'SUCCESS')::int AS successes,
            COUNT(*) FILTER (WHERE status = 'FAILED')::int AS failures,
            ROUND(AVG(duration))::int AS avg_duration,
            MIN(duration)::int AS min_duration,
            MAX(duration)::int AS max_duration,
            MAX("startedAt") AS last_run
          FROM job_executions
          WHERE "startedAt" >= ${since}
          GROUP BY "jobName"
          ORDER BY "jobName"
        `;

    // Build where clause for Prisma
    const where: {
      startedAt: { gte: Date };
      jobName?: string;
    } = { startedAt: { gte: since } };
    if (jobFilter) where.jobName = jobFilter;

    // Detailed executions
    const executions = await prisma.jobExecution.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: jobFilter ? limit : 500,
      select: {
        id: true,
        jobName: true,
        status: true,
        triggerSource: true,
        startedAt: true,
        completedAt: true,
        duration: true,
        itemsProcessed: true,
        error: true,
      },
    });

    // Group executions by jobName
    const executionsByJob = new Map<string, typeof executions>();
    for (const exec of executions) {
      const arr = executionsByJob.get(exec.jobName) || [];
      arr.push(exec);
      executionsByJob.set(exec.jobName, arr);
    }

    // Assemble response
    const jobs = statsRaw.map((s) => ({
      jobName: s.jobName,
      stats: {
        total: s.total,
        successes: s.successes,
        failures: s.failures,
        successRate: s.total > 0 ? Math.round((s.successes / s.total) * 100) : 0,
        avgDuration: s.avg_duration,
        minDuration: s.min_duration,
        maxDuration: s.max_duration,
        lastRun: s.last_run,
      },
      executions: (executionsByJob.get(s.jobName) || []).slice(0, limit),
    }));

    res.json({ jobs, rangeHours, generatedAt: new Date().toISOString() });
  } catch (err) {
    log.error({ err }, 'Jobs handler failed');
    res.status(500).json({ error: 'Failed to load jobs data' });
  }
}
