/**
 * Theme Progress Service — FSRS-5 Phase 2
 *
 * Computes per-theme learning metrics and manages phase transitions.
 * The card path is: Theme → ContentTheme → Content → Quiz → Card (filtered by userId).
 */

import { prisma } from '../config/database.js';
import { ThemePhase } from '@prisma/client';
import { logger } from '../config/logger.js';

const log = logger.child({ service: 'theme-progress' });

// ============================================================================
// FSRS Retrievability helper (same formula as Phase 1)
// ============================================================================

/**
 * FSRS-5 forgetting curve: R(t, S) = (1 + (19/81) * t / S) ^ (-0.5)
 */
function retrievability(daysSinceReview: number, stability: number): number {
  if (stability <= 0) return 0;
  if (daysSinceReview <= 0) return 1;
  return Math.pow(1 + (19 / 81) * daysSinceReview / stability, -0.5);
}

// ============================================================================
// Metric computation
// ============================================================================

interface ThemeMetrics {
  totalCards: number;
  masteredCards: number; // stability > 30 days
  meanRetrievability: number;
  meanStability: number;
  stableCards: number; // stability > 7 days (for ACTIVE → CONSOLIDATING)
  latestContentAssignedAt: Date | null;
}

/**
 * Compute aggregated metrics for a theme by traversing:
 *   Theme → ContentTheme → Content → Quiz → Card
 */
async function computeThemeMetrics(themeId: string, userId: string): Promise<ThemeMetrics> {
  const now = new Date();

  // Get all cards belonging to this theme for this user
  const cards = await prisma.card.findMany({
    where: {
      userId,
      quiz: {
        content: {
          contentThemes: {
            some: { themeId },
          },
        },
      },
    },
    select: {
      stability: true,
      updatedAt: true,
      repetitions: true,
    },
  });

  // Also include synthesis cards (quiz.themeId directly)
  const synthesisCards = await prisma.card.findMany({
    where: {
      userId,
      quiz: {
        themeId,
        isSynthesis: true,
      },
    },
    select: {
      stability: true,
      updatedAt: true,
      repetitions: true,
    },
  });

  const allCards = [...cards, ...synthesisCards];

  if (allCards.length === 0) {
    return {
      totalCards: 0,
      masteredCards: 0,
      meanRetrievability: 1.0,
      meanStability: 0,
      stableCards: 0,
      latestContentAssignedAt: null,
    };
  }

  let sumR = 0;
  let sumS = 0;
  let mastered = 0;
  let stable = 0;

  for (const card of allCards) {
    const daysSince = (now.getTime() - card.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
    const r = card.repetitions > 0 ? retrievability(daysSince, card.stability) : 1.0;
    sumR += r;
    sumS += card.stability;
    if (card.stability > 30) mastered++;
    if (card.stability > 7) stable++;
  }

  // Get latest content assignment date for dormant detection
  const latestAssignment = await prisma.contentTheme.findFirst({
    where: { themeId },
    orderBy: { assignedAt: 'desc' },
    select: { assignedAt: true },
  });

  return {
    totalCards: allCards.length,
    masteredCards: mastered,
    meanRetrievability: sumR / allCards.length,
    meanStability: sumS / allCards.length,
    stableCards: stable,
    latestContentAssignedAt: latestAssignment?.assignedAt ?? null,
  };
}

// ============================================================================
// Phase transition logic
// ============================================================================

interface TransitionResult {
  newPhase: ThemePhase;
  changed: boolean;
  nextRecallAt: Date | null;
}

function evaluatePhaseTransition(
  currentPhase: ThemePhase,
  metrics: ThemeMetrics,
  lastRecallScore: number | null,
  lastRecallAt: Date | null,
): TransitionResult {
  const now = new Date();

  // --- Reactivation: any phase → ACTIVE ---
  if (lastRecallScore !== null && lastRecallScore < 0.6) {
    return { newPhase: 'ACTIVE', changed: currentPhase !== 'ACTIVE', nextRecallAt: null };
  }

  // Check for recent new content → reactivate to ACTIVE
  if (
    metrics.latestContentAssignedAt &&
    (currentPhase === 'CONSOLIDATING' || currentPhase === 'ANCHORED' || currentPhase === 'DORMANT')
  ) {
    const daysSinceNewContent = (now.getTime() - metrics.latestContentAssignedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceNewContent < 2) {
      // New content added in last 2 days → reactivate
      return { newPhase: 'ACTIVE', changed: true, nextRecallAt: null };
    }
  }

  // --- Forward transitions ---
  switch (currentPhase) {
    case 'DISCOVERING': {
      // DISCOVERING → ACTIVE when 5+ cards
      if (metrics.totalCards >= 5) {
        return { newPhase: 'ACTIVE', changed: true, nextRecallAt: null };
      }
      return { newPhase: 'DISCOVERING', changed: false, nextRecallAt: null };
    }

    case 'ACTIVE': {
      // ACTIVE → CONSOLIDATING when 80%+ cards have stability > 7 days
      if (metrics.totalCards >= 5 && metrics.stableCards / metrics.totalCards >= 0.8) {
        // Schedule first recall in 3 days
        const firstRecall = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        return { newPhase: 'CONSOLIDATING', changed: true, nextRecallAt: firstRecall };
      }
      return { newPhase: 'ACTIVE', changed: false, nextRecallAt: null };
    }

    case 'CONSOLIDATING': {
      // CONSOLIDATING → ANCHORED when lastRecallScore >= 0.8 AND meanStability > 30
      if (
        lastRecallScore !== null &&
        lastRecallScore >= 0.8 &&
        metrics.meanStability > 30
      ) {
        // Schedule first anchored recall in 21 days
        const anchoredRecall = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);
        return { newPhase: 'ANCHORED', changed: true, nextRecallAt: anchoredRecall };
      }

      // Compute next recall based on last score
      let nextRecallAt: Date | null = null;
      if (lastRecallAt) {
        const daysUntilNext = (lastRecallScore !== null && lastRecallScore < 0.8) ? 3 : 5;
        nextRecallAt = new Date(lastRecallAt.getTime() + daysUntilNext * 24 * 60 * 60 * 1000);
      }
      return { newPhase: 'CONSOLIDATING', changed: false, nextRecallAt };
    }

    case 'ANCHORED': {
      // ANCHORED → DORMANT when no new content in 60 days AND all cards S > 60
      if (metrics.latestContentAssignedAt) {
        const daysSinceContent = (now.getTime() - metrics.latestContentAssignedAt.getTime()) / (1000 * 60 * 60 * 24);
        const allCardsSuperStable = metrics.totalCards > 0 && metrics.meanStability > 60;
        if (daysSinceContent > 60 && allCardsSuperStable) {
          return { newPhase: 'DORMANT', changed: true, nextRecallAt: null };
        }
      }

      // Compute next anchored recall (21-30 days)
      let nextRecallAt: Date | null = null;
      if (lastRecallAt) {
        const daysUntilNext = (lastRecallScore !== null && lastRecallScore >= 0.9) ? 30 : 21;
        nextRecallAt = new Date(lastRecallAt.getTime() + daysUntilNext * 24 * 60 * 60 * 1000);
      }
      return { newPhase: 'ANCHORED', changed: false, nextRecallAt };
    }

    case 'DORMANT': {
      // DORMANT stays dormant unless reactivated (handled above)
      return { newPhase: 'DORMANT', changed: false, nextRecallAt: null };
    }

    default:
      return { newPhase: currentPhase, changed: false, nextRecallAt: null };
  }
}

// ============================================================================
// Main worker function
// ============================================================================

/**
 * Theme Progress Worker — runs hourly via cron.
 *
 * 1. Find all themes that have ContentTheme entries
 * 2. Upsert ThemeProgress for each
 * 3. Compute metrics via Card join
 * 4. Evaluate phase transitions
 * 5. Update nextRecallAt scheduling
 */
export async function runThemeProgressWorker(): Promise<void> {
  log.info('Theme progress worker starting');

  // Get all themes that have at least one ContentTheme
  // Group by userId + themeId to handle per-user progress
  const themesWithContent = await prisma.contentTheme.findMany({
    select: {
      themeId: true,
      theme: {
        select: {
          userId: true,
        },
      },
    },
    distinct: ['themeId'],
  });

  if (themesWithContent.length === 0) {
    log.debug('No themes with content found');
    return;
  }

  // Deduplicate by (userId, themeId) — each theme belongs to one user
  const themeEntries = themesWithContent.map(ct => ({
    themeId: ct.themeId,
    userId: ct.theme.userId,
  }));

  let updated = 0;
  let transitioned = 0;
  let errors = 0;

  for (const { themeId, userId } of themeEntries) {
    try {
      // 1. Upsert ThemeProgress
      const existing = await prisma.themeProgress.findUnique({
        where: { userId_themeId: { userId, themeId } },
      });

      // 2. Compute metrics
      const metrics = await computeThemeMetrics(themeId, userId);

      // 3. Evaluate phase transition
      const currentPhase = existing?.phase ?? 'DISCOVERING';
      const transition = evaluatePhaseTransition(
        currentPhase,
        metrics,
        existing?.lastRecallScore ?? null,
        existing?.lastRecallAt ?? null,
      );

      // 4. Upsert with new data
      const data = {
        meanRetrievability: Math.round(metrics.meanRetrievability * 1000) / 1000,
        meanStability: Math.round(metrics.meanStability * 100) / 100,
        totalCards: metrics.totalCards,
        masteredCards: metrics.masteredCards,
        phase: transition.newPhase,
        ...(transition.changed ? { phaseStartedAt: new Date() } : {}),
        ...(transition.nextRecallAt ? { nextRecallAt: transition.nextRecallAt } : {}),
      };

      await prisma.themeProgress.upsert({
        where: { userId_themeId: { userId, themeId } },
        create: {
          userId,
          themeId,
          ...data,
        },
        update: data,
      });

      updated++;
      if (transition.changed) {
        transitioned++;
        log.info(
          { themeId, userId, from: currentPhase, to: transition.newPhase, metrics: { totalCards: metrics.totalCards, meanR: metrics.meanRetrievability, meanS: metrics.meanStability } },
          'Theme phase transitioned'
        );
      }
    } catch (error) {
      errors++;
      log.error({ err: error, themeId, userId }, 'Failed to update theme progress');
    }
  }

  log.info({ updated, transitioned, errors, total: themeEntries.length }, 'Theme progress worker completed');
}

/**
 * Backfill ThemeProgress for all existing themes that have content with quizzes.
 * Run once after migration.
 */
export async function backfillThemeProgress(): Promise<void> {
  log.info('Backfilling ThemeProgress for existing themes');

  // Find all themes that have content with quizzes
  const themes = await prisma.theme.findMany({
    where: {
      contentThemes: {
        some: {
          content: {
            quizzes: {
              some: {},
            },
          },
        },
      },
    },
    select: {
      id: true,
      userId: true,
      name: true,
    },
  });

  if (themes.length === 0) {
    log.info('No themes with quizzed content found for backfill');
    return;
  }

  let created = 0;
  let skipped = 0;

  for (const theme of themes) {
    // Check if already exists
    const exists = await prisma.themeProgress.findUnique({
      where: { userId_themeId: { userId: theme.userId, themeId: theme.id } },
    });

    if (exists) {
      skipped++;
      continue;
    }

    // Compute metrics for initial state
    const metrics = await computeThemeMetrics(theme.id, theme.userId);

    // Determine initial phase
    let initialPhase: ThemePhase = 'DISCOVERING';
    if (metrics.totalCards >= 5) {
      if (metrics.stableCards / metrics.totalCards >= 0.8) {
        initialPhase = 'CONSOLIDATING';
      } else {
        initialPhase = 'ACTIVE';
      }
    }

    await prisma.themeProgress.create({
      data: {
        userId: theme.userId,
        themeId: theme.id,
        phase: initialPhase,
        meanRetrievability: Math.round(metrics.meanRetrievability * 1000) / 1000,
        meanStability: Math.round(metrics.meanStability * 100) / 100,
        totalCards: metrics.totalCards,
        masteredCards: metrics.masteredCards,
      },
    });

    created++;
    log.info(
      { themeId: theme.id, themeName: theme.name, phase: initialPhase, totalCards: metrics.totalCards },
      'Backfilled ThemeProgress'
    );
  }

  log.info({ created, skipped, total: themes.length }, 'ThemeProgress backfill completed');
}
