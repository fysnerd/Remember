/**
 * Reminder Worker — FSRS-5 Phase 4 (refactored)
 *
 * 2 push types (recall challenge is handled by themeRecallWorker):
 *   1. Daily review (20h local): cards due > 0, no review today
 *   2. Reactivation (J+3 / J+7 / J+14): progressive re-engagement
 *
 * Anti-spam rules:
 *   - MAX 1 push/day
 *   - MAX 3 pushes/week
 *   - STOP after 3 ignored pushes → weekly digest mode (1/week)
 *   - Never before 8h or after 22h user timezone
 *   - Reset pushIgnoredCount when user returns spontaneously
 */

import { logger } from '../config/logger.js';
import { prisma } from '../config/database.js';
import { sendPushToUser } from '../services/pushNotifications.js';
import { normalizeLanguage } from '../utils/language.js';

const log = logger.child({ job: 'reminder' });

// ============================================================================
// Time helpers
// ============================================================================

function getUserCurrentTime(timezone: string): { hour: number; minute: number } {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const [h, m] = formatter.format(now).split(':').map(Number);
    return { hour: h, minute: m };
  } catch {
    const now = new Date();
    return { hour: now.getUTCHours(), minute: now.getUTCMinutes() };
  }
}

function getUserTodayDate(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(new Date());
  }
}

function wasSentToday(sentAt: Date | null, timezone: string): boolean {
  if (!sentAt) return false;
  const todayStr = getUserTodayDate(timezone);
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(sentAt) === todayStr;
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(sentAt) === todayStr;
  }
}

// ============================================================================
// Anti-spam guard
// ============================================================================

interface AntiSpamResult {
  allowed: boolean;
  reason?: string;
}

function checkAntiSpam(settings: {
  lastPushSentAt: Date | null;
  pushIgnoredCount: number;
  weeklyPushCount: number;
  weeklyPushResetAt: Date | null;
  timezone: string;
}): AntiSpamResult {
  const tz = settings.timezone || 'UTC';
  const { hour } = getUserCurrentTime(tz);
  const now = new Date();

  // Never before 8h or after 22h
  if (hour < 8 || hour >= 22) {
    return { allowed: false, reason: 'outside-hours' };
  }

  // MAX 1 push/day
  if (wasSentToday(settings.lastPushSentAt, tz)) {
    return { allowed: false, reason: 'already-sent-today' };
  }

  // Reset weekly counter if needed (every Monday)
  let weeklyCount = settings.weeklyPushCount;
  if (settings.weeklyPushResetAt) {
    const daysSinceReset = (now.getTime() - settings.weeklyPushResetAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceReset >= 7) {
      weeklyCount = 0; // will be reset in DB when we send
    }
  }

  // MAX 3 pushes/week
  if (weeklyCount >= 3) {
    return { allowed: false, reason: 'weekly-limit' };
  }

  // STOP after 3 ignored pushes → weekly digest only
  if (settings.pushIgnoredCount >= 3) {
    // In weekly digest mode: allow at most 1/week
    if (settings.lastPushSentAt) {
      const daysSinceLast = (now.getTime() - settings.lastPushSentAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLast < 7) {
        return { allowed: false, reason: 'ignored-digest-mode' };
      }
    }
  }

  return { allowed: true };
}

// ============================================================================
// Record push sent + update anti-spam counters
// ============================================================================

async function recordPushSent(userId: string, weeklyPushResetAt: Date | null): Promise<void> {
  const now = new Date();

  // Reset weekly counter if needed
  let resetWeekly = false;
  if (!weeklyPushResetAt) {
    resetWeekly = true;
  } else {
    const daysSinceReset = (now.getTime() - weeklyPushResetAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceReset >= 7) {
      resetWeekly = true;
    }
  }

  await prisma.userSettings.update({
    where: { userId },
    data: {
      lastPushSentAt: now,
      weeklyPushCount: resetWeekly ? 1 : { increment: 1 },
      ...(resetWeekly ? { weeklyPushResetAt: now } : {}),
      pushIgnoredCount: { increment: 1 }, // assume ignored until proven otherwise
    },
  });
}

// ============================================================================
// Main worker
// ============================================================================

export async function runReminderWorker(): Promise<void> {
  log.info('Starting');

  try {
    let dailyReviewSent = 0;
    let reactivationSent = 0;
    let skippedSpam = 0;

    // First: reset pushIgnoredCount for users who came back spontaneously
    // (last review is after last push sent)
    await prisma.$executeRaw`
      UPDATE "UserSettings" SET "pushIgnoredCount" = 0
      WHERE "pushIgnoredCount" > 0
      AND "userId" IN (
        SELECT u."id" FROM "User" u
        JOIN "Review" r ON r."userId" = u."id"
        JOIN "UserSettings" us ON us."userId" = u."id"
        WHERE r."createdAt" > COALESCE(us."lastPushSentAt", '1970-01-01')
        GROUP BY u."id"
      )
    `;

    // Get all users with push tokens and settings
    const usersWithSettings = await prisma.userSettings.findMany({
      where: {
        emailReminders: true,
        user: {
          pushTokens: { some: {} }, // at least one push token
        },
      },
      include: {
        user: { select: { id: true, language: true } },
      },
    });

    for (const settings of usersWithSettings) {
      const tz = settings.timezone || 'UTC';
      const lang = normalizeLanguage(settings.user.language);
      const { hour, minute } = getUserCurrentTime(tz);
      const userId = settings.userId;

      // ── Anti-spam check ──
      const spamCheck = checkAntiSpam({
        lastPushSentAt: settings.lastPushSentAt,
        pushIgnoredCount: settings.pushIgnoredCount,
        weeklyPushCount: settings.weeklyPushCount,
        weeklyPushResetAt: settings.weeklyPushResetAt,
        timezone: tz,
      });

      if (!spamCheck.allowed) {
        if (spamCheck.reason !== 'outside-hours') {
          skippedSpam++;
        }
        continue;
      }

      // ── Check last review date for routing ──
      const lastReview = await prisma.review.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });

      const daysSinceLastReview = lastReview
        ? (Date.now() - lastReview.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        : Infinity;

      // ── Route 1: Reactivation (J+3 / J+7 / J+14) ──
      if (daysSinceLastReview >= 3) {
        let title: string;
        let body: string;
        let deepLink = 'ankora://review?mode=quick';

        if (daysSinceLastReview >= 14) {
          // J+14: gentle, easy cards
          title = lang === 'en' ? 'Shall we start again gently?' : 'On reprend doucement ?';
          body = lang === 'en'
            ? '3 easy questions to get back on track'
            : '3 questions faciles pour reprendre en douceur';
        } else if (daysSinceLastReview >= 7) {
          // J+7: light urgency
          title = lang === 'en' ? 'Your knowledge is slipping' : 'Tes acquis glissent';
          body = lang === 'en'
            ? '5 questions to catch up — 2 min'
            : '5 questions pour rattraper — 2 min';
          deepLink = 'ankora://review?mode=daily';
        } else {
          // J+3: encouraging
          // Find most fragile theme
          const fragileTheme = await prisma.themeProgress.findFirst({
            where: { userId, totalCards: { gt: 0 } },
            orderBy: { meanRetrievability: 'asc' },
            include: { theme: { select: { name: true, emoji: true } } },
          });

          const themeName = fragileTheme
            ? `${fragileTheme.theme.emoji || ''} ${fragileTheme.theme.name}`.trim()
            : '';

          title = lang === 'en'
            ? '3 quick questions to keep your gains'
            : '3 questions rapides pour garder tes acquis';
          body = themeName
            ? (lang === 'en' ? `About ${themeName}` : `Sur ${themeName}`)
            : (lang === 'en' ? 'A quick session to stay sharp' : 'Une petite session pour rester au top');
        }

        const result = await sendPushToUser(userId, title, body, {
          screen: '/(tabs)',
          deepLink,
        });

        if (result.sent > 0) {
          reactivationSent++;
          await recordPushSent(userId, settings.weeklyPushResetAt);
        }
        continue; // don't also send daily review
      }

      // ── Route 2: Daily review (20h local, sleep consolidation) ──
      const currentMinutes = hour * 60 + minute;
      const eveningTarget = 20 * 60; // 20:00
      const isEveningWindow = Math.abs(currentMinutes - eveningTarget) <= 7; // 7-min window

      if (isEveningWindow) {
        // Check if user has reviewed today
        const todayStart = new Date(getUserTodayDate(tz) + 'T00:00:00Z');
        const reviewedToday = await prisma.review.count({
          where: { userId, createdAt: { gte: todayStart } },
          take: 1,
        });

        if (reviewedToday > 0) continue; // already reviewed, no need

        // Check due cards
        const dueCount = await prisma.card.count({
          where: {
            userId,
            nextReviewAt: { lte: new Date() },
          },
        });

        if (dueCount === 0) continue; // no cards due

        // Find the most due theme (lowest meanR with cards)
        const mostDueTheme = await prisma.themeProgress.findFirst({
          where: { userId, totalCards: { gt: 0 } },
          orderBy: { meanRetrievability: 'asc' },
          include: { theme: { select: { name: true, emoji: true } } },
        });

        const cardCount = Math.min(dueCount, 5);
        let title: string;
        let body: string;

        if (mostDueTheme) {
          const tn = `${mostDueTheme.theme.emoji || ''} ${mostDueTheme.theme.name}`.trim();
          title = lang === 'en'
            ? `${cardCount} questions on ${tn}`
            : `${cardCount} questions sur ${tn}`;
          body = lang === 'en' ? '2 min before bed — sleep locks it in' : '2 min avant de dormir — le sommeil ancre la mémoire';
        } else {
          title = lang === 'en'
            ? `${cardCount} questions waiting for you`
            : `${cardCount} questions t'attendent`;
          body = lang === 'en' ? 'A quick review before bed?' : 'Une petite révision avant de dormir ?';
        }

        const result = await sendPushToUser(userId, title, body, {
          screen: '/(tabs)',
          deepLink: 'ankora://review?mode=daily',
        });

        if (result.sent > 0) {
          dailyReviewSent++;
          await recordPushSent(userId, settings.weeklyPushResetAt);
        }
      }
    }

    log.info(
      { dailyReviewSent, reactivationSent, skippedSpam, totalUsers: usersWithSettings.length },
      'Reminders completed'
    );
  } catch (error) {
    log.error({ err: error }, 'Worker error');
  }
}
