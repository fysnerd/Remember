import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { logger } from '../config/logger.js';

const log = logger.child({ route: 'home' });
export const homeRouter = Router();
homeRouter.use(authenticateToken);

// ============================================================================
// Types
// ============================================================================

export type Recommendation = {
  id: string;
  type: 'content' | 'theme';
  title: string;
  subtitle: string;
  thumbnailUrl: string | null;
  emoji: string | null;
  color: string | null;
  questionCount: number;
  dueCount: number;
  platform: string | null;
  channelName: string | null;
  capturedAt: string | null;
  reason: string;
  completed?: boolean;
  dailyRecId?: string;
};

// ============================================================================
// Helper: get user's today date string in their timezone
// ============================================================================

function getUserTodayDate(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(new Date());
  }
}

// ============================================================================
// Helper: generate fresh recommendations (existing algorithm extracted)
// ============================================================================

const formatSubtitle = (platform: string, channelName: string | null): string => {
  const platformNames: Record<string, string> = {
    YOUTUBE: 'YouTube',
    SPOTIFY: 'Spotify',
    TIKTOK: 'TikTok',
    INSTAGRAM: 'Instagram',
  };
  const pName = platformNames[platform] || platform;
  return channelName ? `${pName} - ${channelName}` : pName;
};

export async function generateRecommendations(userId: string): Promise<Recommendation[]> {
  // Step 0: Exclude content/themes already COMPLETED in the last 3 days
  // Non-completed recs can reappear so users get another chance
  const recentAll = await prisma.$queryRaw<{ targetType: string; targetId: string }[]>`
    SELECT DISTINCT "targetType", "targetId"
    FROM "DailyRecommendation"
    WHERE "userId" = ${userId}
      AND date >= (CURRENT_DATE - INTERVAL '3 days')
      AND "completedAt" IS NOT NULL
  `;
  const recentContentIds = new Set(recentAll.filter(r => r.targetType === 'content').map(r => r.targetId));
  const recentThemeIds = new Set(recentAll.filter(r => r.targetType === 'theme').map(r => r.targetId));

  // Step 1: Interest profile - top reviewed tags & themes
  const [topTags, topThemes] = await Promise.all([
    prisma.$queryRaw<{ tagId: string; name: string; cnt: bigint }[]>`
      SELECT t.id AS "tagId", t.name, COUNT(r.id) AS cnt
      FROM "Review" r
      JOIN "Card" c ON c.id = r."cardId"
      JOIN "Quiz" q ON q.id = c."quizId"
      JOIN "Content" co ON co.id = q."contentId"
      JOIN "_ContentTags" ct ON ct."A" = co.id
      JOIN "Tag" t ON t.id = ct."B"
      WHERE r."userId" = ${userId}
      GROUP BY t.id, t.name
      ORDER BY cnt DESC
      LIMIT 10
    `,
    prisma.$queryRaw<{ themeId: string; cnt: bigint }[]>`
      SELECT cth."themeId", COUNT(r.id) AS cnt
      FROM "Review" r
      JOIN "Card" c ON c.id = r."cardId"
      JOIN "Quiz" q ON q.id = c."quizId"
      JOIN "ContentTheme" cth ON cth."contentId" = q."contentId"
      WHERE r."userId" = ${userId}
      GROUP BY cth."themeId"
      ORDER BY cnt DESC
      LIMIT 5
    `,
  ]);

  const hasHistory = topTags.length > 0 || topThemes.length > 0;
  const interestTagIds = new Set(topTags.map(t => t.tagId));

  // Step 2: Content candidates - READY with quizzes
  const contentCandidates = await prisma.$queryRaw<{
    id: string;
    title: string;
    thumbnailUrl: string | null;
    platform: string;
    channelName: string | null;
    questionCount: bigint;
    dueCount: bigint;
    capturedAt: Date;
  }[]>`
    SELECT
      co.id, co.title, co."thumbnailUrl", co.platform::text, co."channelName",
      COUNT(DISTINCT q.id) AS "questionCount",
      COUNT(DISTINCT card.id) FILTER (WHERE card."nextReviewAt" <= NOW()) AS "dueCount",
      co."capturedAt"
    FROM "Content" co
    JOIN "Quiz" q ON q."contentId" = co.id AND q."isSynthesis" = false
    LEFT JOIN "Card" card ON card."quizId" = q.id AND card."userId" = ${userId}
    WHERE co."userId" = ${userId} AND co.status = 'READY'
    GROUP BY co.id
    ORDER BY
      COUNT(DISTINCT card.id) FILTER (WHERE card."nextReviewAt" <= NOW()) DESC,
      co."capturedAt" DESC
    LIMIT 15
  `;

  // Filter out recently recommended content
  const filteredContent = contentCandidates.filter(c => !recentContentIds.has(c.id));
  // Fall back to unfiltered if filtering leaves nothing
  const effectiveContent = filteredContent.length > 0 ? filteredContent : contentCandidates;

  // Compute tag overlap in JS for interest-based ranking
  let rankedContent = effectiveContent;
  if (hasHistory && interestTagIds.size > 0 && effectiveContent.length > 0) {
    const contentIds = effectiveContent.map(c => c.id);
    const contentsWithTags = await prisma.content.findMany({
      where: { id: { in: contentIds } },
      select: { id: true, tags: { select: { id: true } } },
    });

    const overlapMap = new Map<string, number>();
    for (const c of contentsWithTags) {
      const overlap = c.tags.filter(t => interestTagIds.has(t.id)).length;
      if (overlap > 0) overlapMap.set(c.id, overlap);
    }

    rankedContent = [...effectiveContent].sort((a, b) => {
      const overlapDiff = (overlapMap.get(b.id) || 0) - (overlapMap.get(a.id) || 0);
      if (overlapDiff !== 0) return overlapDiff;
      const dueDiff = Number(b.dueCount) - Number(a.dueCount);
      if (dueDiff !== 0) return dueDiff;
      return new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime();
    });
  }

  // Step 3: Theme candidates - discovered with >= 3 quizzable contents
  // Use ThemeProgress.meanRetrievability for smarter ordering (lowest R = most at risk)
  const themeCandidates = await prisma.$queryRaw<{
    id: string;
    name: string;
    emoji: string;
    color: string;
    contentCount: bigint;
    questionCount: bigint;
    dueCount: bigint;
    meanRetrievability: number | null;
  }[]>`
    SELECT
      t.id, t.name, t.emoji, t.color,
      COUNT(DISTINCT cth."contentId") AS "contentCount",
      COUNT(DISTINCT q.id) AS "questionCount",
      COUNT(DISTINCT card.id) FILTER (WHERE card."nextReviewAt" <= NOW()) AS "dueCount",
      tp."meanRetrievability"
    FROM "Theme" t
    JOIN "ContentTheme" cth ON cth."themeId" = t.id
    JOIN "Content" co ON co.id = cth."contentId" AND co.status = 'READY'
    JOIN "Quiz" q ON q."contentId" = co.id AND q."isSynthesis" = false
    LEFT JOIN "Card" card ON card."quizId" = q.id AND card."userId" = ${userId}
    LEFT JOIN "ThemeProgress" tp ON tp."themeId" = t.id AND tp."userId" = ${userId}
    WHERE t."userId" = ${userId} AND t."discoveredAt" IS NOT NULL
    GROUP BY t.id, tp."meanRetrievability"
    HAVING COUNT(DISTINCT cth."contentId") >= 3
    ORDER BY
      tp."meanRetrievability" ASC NULLS LAST,
      COUNT(DISTINCT card.id) FILTER (WHERE card."nextReviewAt" <= NOW()) DESC,
      COUNT(DISTINCT cth."contentId") DESC
    LIMIT 5
  `;

  // Filter out recently recommended themes
  const filteredThemes = themeCandidates.filter(t => !recentThemeIds.has(t.id));
  // Fall back to unfiltered if filtering leaves nothing
  const effectiveThemes = filteredThemes.length > 0 ? filteredThemes : themeCandidates;

  // Step 4: Mix 3 slots
  const recommendations: Recommendation[] = [];
  const usedContentIds = new Set<string>();
  const usedThemeIds = new Set<string>();
  const reason = hasHistory ? 'Base sur vos centres d\'interet' : 'Contenu recent';

  // Slot 1: best theme with due cards, otherwise best content
  const bestTheme = effectiveThemes.find(t => Number(t.dueCount) > 0);
  if (bestTheme) {
    recommendations.push({
      id: bestTheme.id, type: 'theme', title: bestTheme.name,
      subtitle: `${Number(bestTheme.contentCount)} contenus`,
      thumbnailUrl: null, emoji: bestTheme.emoji, color: bestTheme.color,
      questionCount: Number(bestTheme.questionCount), dueCount: Number(bestTheme.dueCount),
      platform: null, channelName: null, capturedAt: null, reason,
    });
    usedThemeIds.add(bestTheme.id);
  } else if (rankedContent.length > 0) {
    const c = rankedContent[0];
    recommendations.push({
      id: c.id, type: 'content', title: c.title,
      subtitle: formatSubtitle(c.platform, c.channelName),
      thumbnailUrl: c.thumbnailUrl, emoji: null, color: null,
      questionCount: Number(c.questionCount), dueCount: Number(c.dueCount),
      platform: c.platform, channelName: c.channelName,
      capturedAt: c.capturedAt.toISOString(), reason,
    });
    usedContentIds.add(c.id);
  }

  // Slots 2-3: best contents (excluding those in the selected theme)
  let themeContentIds = new Set<string>();
  if (bestTheme) {
    const themeContents = await prisma.contentTheme.findMany({
      where: { themeId: bestTheme.id },
      select: { contentId: true },
    });
    themeContentIds = new Set(themeContents.map(tc => tc.contentId));
  }

  for (const c of rankedContent) {
    if (recommendations.length >= 3) break;
    if (usedContentIds.has(c.id)) continue;
    if (themeContentIds.has(c.id)) continue;
    recommendations.push({
      id: c.id, type: 'content', title: c.title,
      subtitle: formatSubtitle(c.platform, c.channelName),
      thumbnailUrl: c.thumbnailUrl, emoji: null, color: null,
      questionCount: Number(c.questionCount), dueCount: Number(c.dueCount),
      platform: c.platform, channelName: c.channelName,
      capturedAt: c.capturedAt.toISOString(), reason,
    });
    usedContentIds.add(c.id);
  }

  // Fill remaining slots with themes
  for (const t of effectiveThemes) {
    if (recommendations.length >= 3) break;
    if (usedThemeIds.has(t.id)) continue;
    recommendations.push({
      id: t.id, type: 'theme', title: t.name,
      subtitle: `${Number(t.contentCount)} contenus`,
      thumbnailUrl: null, emoji: t.emoji, color: t.color,
      questionCount: Number(t.questionCount), dueCount: Number(t.dueCount),
      platform: null, channelName: null, capturedAt: null, reason,
    });
    usedThemeIds.add(t.id);
  }

  // Step 5: Fallback - most recent READY content
  if (recommendations.length === 0) {
    const fallback = await prisma.$queryRaw<{
      id: string; title: string; thumbnailUrl: string | null;
      platform: string; channelName: string | null;
      questionCount: bigint; dueCount: bigint; capturedAt: Date;
    }[]>`
      SELECT
        co.id, co.title, co."thumbnailUrl", co.platform::text, co."channelName",
        COUNT(DISTINCT q.id) AS "questionCount",
        COUNT(DISTINCT card.id) FILTER (WHERE card."nextReviewAt" <= NOW()) AS "dueCount",
        co."capturedAt"
      FROM "Content" co
      JOIN "Quiz" q ON q."contentId" = co.id AND q."isSynthesis" = false
      LEFT JOIN "Card" card ON card."quizId" = q.id AND card."userId" = ${userId}
      WHERE co."userId" = ${userId} AND co.status = 'READY'
      GROUP BY co.id
      ORDER BY co."capturedAt" DESC
      LIMIT 3
    `;
    for (const c of fallback) {
      recommendations.push({
        id: c.id, type: 'content', title: c.title,
        subtitle: formatSubtitle(c.platform, c.channelName),
        thumbnailUrl: c.thumbnailUrl, emoji: null, color: null,
        questionCount: Number(c.questionCount), dueCount: Number(c.dueCount),
        platform: c.platform, channelName: c.channelName,
        capturedAt: c.capturedAt.toISOString(), reason: 'Contenu recent',
      });
    }
  }

  return recommendations;
}

// ============================================================================
// Helper: hydrate DailyRecommendation rows into full Recommendation objects
// ============================================================================

async function hydrateRecommendations(
  dailyRecs: { id: string; slot: number; targetType: string; targetId: string; completedAt: Date | null }[],
  userId: string,
): Promise<Recommendation[]> {
  const results: Recommendation[] = [];

  for (const rec of dailyRecs.sort((a, b) => a.slot - b.slot)) {
    if (rec.targetType === 'content') {
      const row = await prisma.$queryRaw<{
        id: string; title: string; thumbnailUrl: string | null;
        platform: string; channelName: string | null; status: string;
        questionCount: bigint; dueCount: bigint; capturedAt: Date;
      }[]>`
        SELECT
          co.id, co.title, co."thumbnailUrl", co.platform::text, co."channelName", co.status::text,
          COUNT(DISTINCT q.id) AS "questionCount",
          COUNT(DISTINCT card.id) FILTER (WHERE card."nextReviewAt" <= NOW()) AS "dueCount",
          co."capturedAt"
        FROM "Content" co
        JOIN "Quiz" q ON q."contentId" = co.id AND q."isSynthesis" = false
        LEFT JOIN "Card" card ON card."quizId" = q.id AND card."userId" = ${userId}
        WHERE co.id = ${rec.targetId}
        GROUP BY co.id
      `;
      if (row.length > 0 && row[0].status === 'READY') {
        const c = row[0];
        results.push({
          id: c.id, type: 'content', title: c.title,
          subtitle: formatSubtitle(c.platform, c.channelName),
          thumbnailUrl: c.thumbnailUrl, emoji: null, color: null,
          questionCount: Number(c.questionCount), dueCount: Number(c.dueCount),
          platform: c.platform, channelName: c.channelName,
          capturedAt: c.capturedAt.toISOString(), reason: 'Quiz du jour',
          completed: !!rec.completedAt, dailyRecId: rec.id,
        });
      }
    } else {
      // theme
      const row = await prisma.$queryRaw<{
        id: string; name: string; emoji: string; color: string;
        contentCount: bigint; questionCount: bigint; dueCount: bigint;
      }[]>`
        SELECT
          t.id, t.name, t.emoji, t.color,
          COUNT(DISTINCT cth."contentId") AS "contentCount",
          COUNT(DISTINCT q.id) AS "questionCount",
          COUNT(DISTINCT card.id) FILTER (WHERE card."nextReviewAt" <= NOW()) AS "dueCount"
        FROM "Theme" t
        JOIN "ContentTheme" cth ON cth."themeId" = t.id
        JOIN "Content" co ON co.id = cth."contentId" AND co.status = 'READY'
        JOIN "Quiz" q ON q."contentId" = co.id AND q."isSynthesis" = false
        LEFT JOIN "Card" card ON card."quizId" = q.id AND card."userId" = ${userId}
        WHERE t.id = ${rec.targetId}
        GROUP BY t.id
      `;
      if (row.length > 0) {
        const t = row[0];
        results.push({
          id: t.id, type: 'theme', title: t.name,
          subtitle: `${Number(t.contentCount)} contenus`,
          thumbnailUrl: null, emoji: t.emoji, color: t.color,
          questionCount: Number(t.questionCount), dueCount: Number(t.dueCount),
          platform: null, channelName: null, capturedAt: null, reason: 'Quiz du jour',
          completed: !!rec.completedAt, dailyRecId: rec.id,
        });
      }
    }
  }

  return results;
}

// ============================================================================
// GET /recommendations -- 3 fixed daily quiz recommendations (lazy generation)
// ============================================================================

homeRouter.get('/recommendations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    // Get user timezone
    const settings = await prisma.userSettings.findUnique({ where: { userId } });
    const tz = settings?.timezone || 'UTC';
    const todayStr = getUserTodayDate(tz);
    const todayDate = new Date(todayStr + 'T00:00:00Z');

    // Check for existing daily recommendations
    let dailyRecs = await prisma.dailyRecommendation.findMany({
      where: { userId, date: todayDate },
      orderBy: { slot: 'asc' },
    });

    if (dailyRecs.length === 0) {
      // Generate fresh recommendations and persist them
      const freshRecs = await generateRecommendations(userId);

      if (freshRecs.length > 0) {
        // Store in DailyRecommendation with race-condition protection
        const toCreate = freshRecs.map((rec, index) => ({
          userId,
          date: todayDate,
          slot: index,
          targetType: rec.type,
          targetId: rec.id,
        }));

        await prisma.dailyRecommendation.createMany({
          data: toCreate,
          skipDuplicates: true,
        });

        // Re-fetch to get the actual persisted rows (with IDs)
        dailyRecs = await prisma.dailyRecommendation.findMany({
          where: { userId, date: todayDate },
          orderBy: { slot: 'asc' },
        });
      }

      if (dailyRecs.length === 0) {
        // No content at all
        log.info({ userId }, 'No daily recommendations (no READY content)');
        return res.json({
          recommendations: [],
          dailyProgress: { completed: 0, total: 0, allDone: false },
        });
      }
    }

    // Hydrate the daily recs into full recommendation objects
    const recommendations = await hydrateRecommendations(dailyRecs, userId);

    const completedCount = dailyRecs.filter(r => r.completedAt).length;
    const total = recommendations.length;

    const dailyProgress = {
      completed: completedCount,
      total,
      allDone: total > 0 && completedCount >= total,
    };

    log.info({ userId, count: recommendations.length, progress: dailyProgress }, 'Daily recommendations served');
    return res.json({ recommendations, dailyProgress });
  } catch (error) {
    return next(error);
  }
});

// ============================================================================
// POST /daily/:dailyRecId/link-session -- Link a quiz session to a daily rec
// ============================================================================

homeRouter.post('/daily/:dailyRecId/link-session', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dailyRecId = req.params.dailyRecId as string;
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    await prisma.dailyRecommendation.update({
      where: { id: dailyRecId, userId: req.user!.id },
      data: { sessionId },
    });

    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});
