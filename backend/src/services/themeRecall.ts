/**
 * Theme Recall Service — FSRS-5 Phase 3
 *
 * Selects cards for recall quizzes and scores completed recall sessions
 * to update ThemeProgress phase and nextRecallAt.
 */

import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';

const log = logger.child({ service: 'theme-recall' });

// ============================================================================
// FSRS Retrievability (same formula as Phase 1 & 2)
// ============================================================================

function retrievability(daysSinceReview: number, stability: number): number {
  if (stability <= 0) return 0;
  if (daysSinceReview <= 0) return 1;
  return Math.pow(1 + (19 / 81) * daysSinceReview / stability, -0.5);
}

// ============================================================================
// Card selection for recall quiz
// ============================================================================

/**
 * Select cards for a recall quiz on a specific theme.
 *
 * Composition (target 5 questions):
 *   1. 3 cards with lowest R from this theme
 *   2. 1 synthesis card (if available)
 *   3. 1 surprise card from another theme (interleaving)
 *
 * Falls back gracefully if fewer cards available (minimum 3).
 */
export async function selectRecallCards(
  themeId: string,
  userId: string,
): Promise<{ cards: any[]; themeProgress: any }> {
  const now = new Date();

  // Get ThemeProgress for context
  const themeProgress = await prisma.themeProgress.findUnique({
    where: { userId_themeId: { userId, themeId } },
    include: { theme: { select: { id: true, name: true, emoji: true } } },
  });

  if (!themeProgress) {
    throw new Error('ThemeProgress not found for this theme');
  }

  // 1. Get theme cards sorted by retrievability (lowest R first = most forgotten)
  const themeCards = await prisma.card.findMany({
    where: {
      userId,
      repetitions: { gt: 0 }, // only reviewed cards
      quiz: {
        content: {
          contentThemes: {
            some: { themeId },
          },
        },
      },
    },
    include: {
      quiz: {
        include: {
          content: {
            select: {
              id: true,
              title: true,
              url: true,
              platform: true,
            },
          },
        },
      },
    },
  });

  // Compute R for each card and sort by lowest R
  const cardsWithR = themeCards.map(card => {
    const daysSince = (now.getTime() - card.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
    const r = retrievability(daysSince, card.stability);
    return { ...card, retrievability: r, source: 'theme' as const };
  }).sort((a, b) => a.retrievability - b.retrievability);

  // Take top 3 most forgotten
  const coreCards = cardsWithR.slice(0, 3);

  // 2. Get 1 synthesis card for this theme (if available)
  const synthesisCards = await prisma.card.findMany({
    where: {
      userId,
      quiz: {
        themeId,
        isSynthesis: true,
      },
    },
    include: {
      quiz: {
        include: {
          theme: { select: { id: true, name: true } },
        },
      },
    },
    take: 5, // get a few to randomize
  });

  // Pick 1 random synthesis card
  let synthesisCard = null;
  if (synthesisCards.length > 0) {
    const randomIdx = Math.floor(Math.random() * synthesisCards.length);
    synthesisCard = synthesisCards[randomIdx];
  }

  // 3. Get 1 surprise card from a different theme (interleaving)
  let interleavingCard = null;

  // Get other themes for this user
  const otherThemeProgresses = await prisma.themeProgress.findMany({
    where: {
      userId,
      themeId: { not: themeId },
      totalCards: { gt: 0 },
    },
    select: { themeId: true },
    take: 10,
  });

  if (otherThemeProgresses.length > 0) {
    // Pick a random other theme
    const randomTheme = otherThemeProgresses[Math.floor(Math.random() * otherThemeProgresses.length)];

    // Get a random card from that theme
    const otherCards = await prisma.card.findMany({
      where: {
        userId,
        repetitions: { gt: 0 },
        quiz: {
          content: {
            contentThemes: {
              some: { themeId: randomTheme.themeId },
            },
          },
        },
      },
      include: {
        quiz: {
          include: {
            content: {
              select: {
                id: true,
                title: true,
                url: true,
                platform: true,
              },
            },
          },
        },
      },
      take: 5,
    });

    if (otherCards.length > 0) {
      interleavingCard = otherCards[Math.floor(Math.random() * otherCards.length)];
    }
  }

  // Assemble final card list
  const allCards: any[] = [...coreCards];

  if (synthesisCard) {
    allCards.push(synthesisCard);
  }

  if (interleavingCard) {
    allCards.push(interleavingCard);
  }

  // If we still have fewer than 3, add more theme cards
  if (allCards.length < 3 && cardsWithR.length > coreCards.length) {
    const remaining = cardsWithR.slice(coreCards.length, coreCards.length + (3 - allCards.length));
    allCards.push(...remaining);
  }

  // For DORMANT themes, only 3 easy cards (highest R)
  if (themeProgress.phase === 'DORMANT') {
    const easyCards = cardsWithR.slice(-3).reverse(); // highest R
    return {
      cards: easyCards.length > 0 ? easyCards : allCards.slice(0, 3),
      themeProgress,
    };
  }

  // Shuffle to avoid predictable order
  const shuffled = allCards.sort(() => Math.random() - 0.5);

  return {
    cards: shuffled,
    themeProgress,
  };
}

// ============================================================================
// Recall scoring — called when recall session is completed
// ============================================================================

/**
 * Score a completed recall session and update ThemeProgress accordingly.
 *
 * - Score >= 80% → phase stays, nextRecall extended
 * - Score 60-79% → nextRecall shortened
 * - Score < 60%  → reactivation to ACTIVE
 */
export async function scoreRecallSession(
  sessionId: string,
  themeId: string,
  userId: string,
): Promise<{ score: number; newPhase: string; nextRecallAt: Date | null }> {
  const now = new Date();

  // Get session reviews
  const session = await prisma.quizSession.findFirst({
    where: { id: sessionId, userId },
  });

  if (!session) {
    throw new Error('Session not found');
  }

  const totalCount = session.totalCount ?? 0;
  const correctCount = session.correctCount ?? 0;
  const score = totalCount > 0 ? correctCount / totalCount : 0;

  // Get current ThemeProgress
  const tp = await prisma.themeProgress.findUnique({
    where: { userId_themeId: { userId, themeId } },
  });

  if (!tp) {
    throw new Error('ThemeProgress not found');
  }

  let newPhase = tp.phase;
  let nextRecallAt: Date | null = null;

  if (score < 0.6) {
    // Reactivation — theme drops back to ACTIVE
    newPhase = 'ACTIVE';
    nextRecallAt = null;
    log.info({ themeId, userId, score, from: tp.phase }, 'Recall score < 0.6: reactivating theme');
  } else if (score < 0.8) {
    // Shortened recall interval
    if (tp.phase === 'CONSOLIDATING') {
      nextRecallAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days
    } else if (tp.phase === 'ANCHORED') {
      nextRecallAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days
    }
    log.info({ themeId, userId, score, nextRecallIn: nextRecallAt }, 'Recall score 60-79%: shortened interval');
  } else {
    // Good recall — extended interval
    if (tp.phase === 'CONSOLIDATING') {
      nextRecallAt = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days
    } else if (tp.phase === 'ANCHORED') {
      nextRecallAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
    }
    log.info({ themeId, userId, score, nextRecallIn: nextRecallAt }, 'Recall score >= 80%: extended interval');
  }

  // Update ThemeProgress
  await prisma.themeProgress.update({
    where: { userId_themeId: { userId, themeId } },
    data: {
      lastRecallAt: now,
      lastRecallScore: Math.round(score * 100) / 100,
      nextRecallAt,
      phase: newPhase,
      ...(newPhase !== tp.phase ? { phaseStartedAt: now } : {}),
    },
  });

  return { score, newPhase, nextRecallAt };
}
