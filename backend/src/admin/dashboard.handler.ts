import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';

const log = logger.child({ component: 'dashboard-handler' });

export const dashboardHandler = async () => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  try {
    const [lastRuns, recentErrors, userCount, contentByPlatform, quizCount, reviewCount, timeline, successRates] =
      await Promise.all([
        // DASH-02: Last run of each job (raw SQL for DISTINCT ON)
        prisma.$queryRaw`
          SELECT DISTINCT ON ("jobName")
            "jobName", status, "triggerSource", "startedAt", duration, error
          FROM job_executions
          ORDER BY "jobName", "startedAt" DESC
        `,
        // DASH-03: Errors last 24h
        prisma.jobExecution.findMany({
          where: { status: 'FAILED', startedAt: { gte: yesterday } },
          orderBy: { startedAt: 'desc' },
          take: 50,
          select: { id: true, jobName: true, error: true, startedAt: true, duration: true, triggerSource: true },
        }),
        // DASH-04: Stats - total users
        prisma.user.count(),
        // DASH-04: Stats - content by platform
        prisma.content.groupBy({ by: ['platform'], _count: true }),
        // DASH-04: Stats - total quizzes
        prisma.quiz.count(),
        // DASH-04: Stats - total reviews
        prisma.review.count(),
        // DASH-05: Timeline (last 100 executions)
        prisma.jobExecution.findMany({
          orderBy: { startedAt: 'desc' },
          take: 100,
          select: { id: true, jobName: true, status: true, triggerSource: true, startedAt: true, duration: true },
        }),
        // DASH-06: Success rates per job (last 7 days)
        prisma.$queryRaw`
          SELECT "jobName",
            COUNT(*)::int as total,
            COUNT(*) FILTER (WHERE status = 'SUCCESS')::int as successes
          FROM job_executions
          WHERE "startedAt" >= ${sevenDaysAgo}
          GROUP BY "jobName"
          ORDER BY "jobName"
        `,
      ]);

    return {
      lastRuns,
      recentErrors,
      stats: { userCount, contentByPlatform, quizCount, reviewCount },
      timeline,
      successRates,
      generatedAt: now.toISOString(),
    };
  } catch (err) {
    log.error({ err }, 'Dashboard handler failed');
    return { error: 'Failed to load dashboard data', generatedAt: now.toISOString() };
  }
};
