/**
 * Theme Recall Worker — FSRS-5 Phase 3
 *
 * Cron every 30 minutes:
 * 1. Find ThemeProgress where nextRecallAt <= now AND phase IN (CONSOLIDATING, ANCHORED)
 * 2. Compute current meanRetrievability
 * 3. If meanR < 0.85 → send push notification
 * 4. If meanR >= 0.85 → postpone nextRecallAt by 2 days
 */

import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';
import { sendPushToUser } from '../services/pushNotifications.js';

const log = logger.child({ service: 'theme-recall-worker' });

// FSRS retrievability
function retrievability(daysSinceReview: number, stability: number): number {
  if (stability <= 0) return 0;
  if (daysSinceReview <= 0) return 1;
  return Math.pow(1 + (19 / 81) * daysSinceReview / stability, -0.5);
}

/**
 * Compute live meanRetrievability for a theme's cards.
 */
async function computeLiveMeanR(themeId: string, userId: string): Promise<number> {
  const now = new Date();

  const cards = await prisma.card.findMany({
    where: {
      userId,
      repetitions: { gt: 0 },
      quiz: {
        content: {
          contentThemes: {
            some: { themeId },
          },
        },
      },
    },
    select: { stability: true, updatedAt: true },
  });

  if (cards.length === 0) return 1.0;

  let sumR = 0;
  for (const card of cards) {
    const daysSince = (now.getTime() - card.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
    sumR += retrievability(daysSince, card.stability);
  }

  return sumR / cards.length;
}

export async function runThemeRecallWorker(): Promise<void> {
  log.info('Theme recall worker starting');

  const now = new Date();

  // Find themes due for recall
  const dueThemes = await prisma.themeProgress.findMany({
    where: {
      nextRecallAt: { lte: now },
      phase: { in: ['CONSOLIDATING', 'ANCHORED'] },
    },
    include: {
      theme: {
        select: { id: true, name: true, emoji: true },
      },
    },
  });

  if (dueThemes.length === 0) {
    log.debug('No themes due for recall');
    return;
  }

  log.info({ count: dueThemes.length }, 'Themes due for recall check');

  let pushed = 0;
  let postponed = 0;
  let errors = 0;

  for (const tp of dueThemes) {
    try {
      // Compute live meanR
      const meanR = await computeLiveMeanR(tp.themeId, tp.userId);

      if (meanR >= 0.85) {
        // Theme still holds — postpone by 2 days
        const postponedDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
        await prisma.themeProgress.update({
          where: { id: tp.id },
          data: {
            nextRecallAt: postponedDate,
            meanRetrievability: Math.round(meanR * 1000) / 1000,
          },
        });
        postponed++;
        log.debug(
          { themeId: tp.themeId, meanR: Math.round(meanR * 100) / 100, postponedTo: postponedDate },
          'Theme recall postponed (meanR still good)'
        );
      } else {
        // meanR dropping — send push notification
        const emoji = tp.theme.emoji || '🧠';
        const themeName = tp.theme.name;

        await sendPushToUser(
          tp.userId,
          `Tu te souviens de ${emoji} ${themeName} ?`,
          'Quick quiz — 5 questions en 2 min',
          {
            type: 'recall',
            themeId: tp.themeId,
            deepLink: `ankora://recall/${tp.themeId}`,
          },
        );

        // Update meanR but don't advance nextRecallAt yet — that happens when session completes
        await prisma.themeProgress.update({
          where: { id: tp.id },
          data: {
            meanRetrievability: Math.round(meanR * 1000) / 1000,
          },
        });

        pushed++;
        log.info(
          { themeId: tp.themeId, themeName, meanR: Math.round(meanR * 100) / 100 },
          'Recall push sent'
        );
      }
    } catch (error) {
      errors++;
      log.error({ err: error, themeId: tp.themeId }, 'Failed to process recall check');
    }
  }

  log.info({ pushed, postponed, errors, total: dueThemes.length }, 'Theme recall worker completed');
}
