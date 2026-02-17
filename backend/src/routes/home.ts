import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { logger } from '../config/logger.js';

const log = logger.child({ route: 'home' });
export const homeRouter = Router();
homeRouter.use(authenticateToken);

// ============================================================================
// GET /recommendations -- 3 quiz recommendations (content or theme) for home
// ============================================================================

homeRouter.get('/recommendations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    // Step 1: Interest profile - top reviewed tags & themes (parallel)
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

    // Step 2: Content candidates - READY with quizzes + their tags
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

    // Compute tag overlap in JS for interest-based ranking
    let rankedContent = contentCandidates;
    if (hasHistory && interestTagIds.size > 0 && contentCandidates.length > 0) {
      const contentIds = contentCandidates.map(c => c.id);
      const contentsWithTags = await prisma.content.findMany({
        where: { id: { in: contentIds } },
        select: { id: true, tags: { select: { id: true } } },
      });

      // Build per-content tag overlap count
      const overlapMap = new Map<string, number>();
      for (const c of contentsWithTags) {
        const overlap = c.tags.filter(t => interestTagIds.has(t.id)).length;
        if (overlap > 0) overlapMap.set(c.id, overlap);
      }

      // Re-sort: tag overlap DESC, dueCount DESC, capturedAt DESC
      rankedContent = [...contentCandidates].sort((a, b) => {
        const overlapDiff = (overlapMap.get(b.id) || 0) - (overlapMap.get(a.id) || 0);
        if (overlapDiff !== 0) return overlapDiff;
        const dueDiff = Number(b.dueCount) - Number(a.dueCount);
        if (dueDiff !== 0) return dueDiff;
        return new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime();
      });
    }

    // Step 3: Theme candidates - discovered with >= 3 quizzable contents
    const themeCandidates = await prisma.$queryRaw<{
      id: string;
      name: string;
      emoji: string;
      color: string;
      contentCount: bigint;
      questionCount: bigint;
      dueCount: bigint;
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
      WHERE t."userId" = ${userId} AND t."discoveredAt" IS NOT NULL
      GROUP BY t.id
      HAVING COUNT(DISTINCT cth."contentId") >= 3
      ORDER BY
        COUNT(DISTINCT card.id) FILTER (WHERE card."nextReviewAt" <= NOW()) DESC,
        COUNT(DISTINCT cth."contentId") DESC
      LIMIT 5
    `;

    // Step 4: Mix 3 slots
    type Recommendation = {
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
    };

    const recommendations: Recommendation[] = [];
    const usedContentIds = new Set<string>();
    const usedThemeIds = new Set<string>();

    const reason = hasHistory ? 'Base sur vos centres d\'interet' : 'Contenu recent';

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

    // Slot 1: best theme with due cards, otherwise best content
    const bestTheme = themeCandidates.find(t => Number(t.dueCount) > 0);
    if (bestTheme) {
      recommendations.push({
        id: bestTheme.id,
        type: 'theme',
        title: bestTheme.name,
        subtitle: `${Number(bestTheme.contentCount)} contenus`,
        thumbnailUrl: null,
        emoji: bestTheme.emoji,
        color: bestTheme.color,
        questionCount: Number(bestTheme.questionCount),
        dueCount: Number(bestTheme.dueCount),
        platform: null,
        channelName: null,
        capturedAt: null,
        reason,
      });
      usedThemeIds.add(bestTheme.id);
    } else if (rankedContent.length > 0) {
      const c = rankedContent[0];
      recommendations.push({
        id: c.id,
        type: 'content',
        title: c.title,
        subtitle: formatSubtitle(c.platform, c.channelName),
        thumbnailUrl: c.thumbnailUrl,
        emoji: null,
        color: null,
        questionCount: Number(c.questionCount),
        dueCount: Number(c.dueCount),
        platform: c.platform,
        channelName: c.channelName,
        capturedAt: c.capturedAt.toISOString(),
        reason,
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
        id: c.id,
        type: 'content',
        title: c.title,
        subtitle: formatSubtitle(c.platform, c.channelName),
        thumbnailUrl: c.thumbnailUrl,
        emoji: null,
        color: null,
        questionCount: Number(c.questionCount),
        dueCount: Number(c.dueCount),
        platform: c.platform,
        channelName: c.channelName,
        capturedAt: c.capturedAt.toISOString(),
        reason,
      });
      usedContentIds.add(c.id);
    }

    // Fill remaining slots with themes
    for (const t of themeCandidates) {
      if (recommendations.length >= 3) break;
      if (usedThemeIds.has(t.id)) continue;

      recommendations.push({
        id: t.id,
        type: 'theme',
        title: t.name,
        subtitle: `${Number(t.contentCount)} contenus`,
        thumbnailUrl: null,
        emoji: t.emoji,
        color: t.color,
        questionCount: Number(t.questionCount),
        dueCount: Number(t.dueCount),
        platform: null,
        channelName: null,
        capturedAt: null,
        reason,
      });
      usedThemeIds.add(t.id);
    }

    // Step 5: Fallback - no recommendations found, use most recent READY content
    if (recommendations.length === 0) {
      const fallback = await prisma.$queryRaw<{
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
        ORDER BY co."capturedAt" DESC
        LIMIT 3
      `;

      for (const c of fallback) {
        recommendations.push({
          id: c.id,
          type: 'content',
          title: c.title,
          subtitle: formatSubtitle(c.platform, c.channelName),
          thumbnailUrl: c.thumbnailUrl,
          emoji: null,
          color: null,
          questionCount: Number(c.questionCount),
          dueCount: Number(c.dueCount),
          platform: c.platform,
          channelName: c.channelName,
          capturedAt: c.capturedAt.toISOString(),
          reason: 'Contenu recent',
        });
      }
    }

    log.info({ userId, count: recommendations.length }, 'Home recommendations served');
    return res.json({ recommendations });
  } catch (error) {
    return next(error);
  }
});
