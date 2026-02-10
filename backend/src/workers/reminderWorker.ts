// Daily Review Reminder Worker (S010)
// Sends email + push reminders for due cards, and inactivity win-back (J+3)
import { logger } from '../config/logger.js';
import { prisma } from '../config/database.js';
import { sendDailyReminder } from '../services/email.js';
import { sendPushToUser } from '../services/pushNotifications.js';

const log = logger.child({ job: 'reminder' });

// Minimum cards due to trigger a push notification
const MIN_CARDS_FOR_PUSH = 5;

// Days of inactivity before sending win-back notification
const INACTIVITY_DAYS = 3;

/**
 * Check if it's time to send a reminder for a user based on their settings
 */
function isReminderTime(reminderTime: string, timezone: string): boolean {
  try {
    // Get current time in user's timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const currentTime = formatter.format(now);

    // Check if current time matches reminder time (within 5 minute window)
    const [reminderHour, reminderMinute] = reminderTime.split(':').map(Number);
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);

    // Allow a 5-minute window for the cron job
    const reminderMinutes = reminderHour * 60 + reminderMinute;
    const currentMinutes = currentHour * 60 + currentMinute;

    return Math.abs(currentMinutes - reminderMinutes) <= 5;
  } catch {
    // Invalid timezone, default to false
    return false;
  }
}

/**
 * Run the daily reminder worker
 * This should be called every 5 minutes by the scheduler
 * Handles: daily review reminders (email + push) and inactivity J+3 win-back (push)
 */
export async function runReminderWorker(): Promise<void> {
  log.info('Starting');

  try {
    let emailSentCount = 0;
    let pushSentCount = 0;
    let inactivitySentCount = 0;

    // ========================================
    // Part 1: Daily review reminders (email + push)
    // ========================================

    const usersWithSettings = await prisma.userSettings.findMany({
      where: {
        emailReminders: true,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    log.info({ userCount: usersWithSettings.length }, 'Found users with reminders enabled');

    for (const settings of usersWithSettings) {
      // Check if it's the right time for this user
      if (!isReminderTime(settings.dailyReminderTime, settings.timezone)) {
        continue;
      }

      // Check if user has already reviewed today (skip if so)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const lastReminder = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count FROM "Review"
        WHERE "userId" = ${settings.userId}
        AND "createdAt" >= ${today}
      `;

      if (lastReminder[0]?.count > 0) {
        continue;
      }

      // Get user's due cards count and streak
      const [dueCount, streak] = await Promise.all([
        prisma.card.count({
          where: {
            userId: settings.userId,
            nextReviewAt: { lte: new Date() },
          },
        }),
        prisma.streak.findUnique({
          where: { userId: settings.userId },
        }),
      ]);

      // Send email reminder
      const emailSuccess = await sendDailyReminder({
        email: settings.user.email,
        userName: settings.user.name || '',
        dueCount,
        currentStreak: streak?.currentStreak || 0,
      });

      if (emailSuccess) {
        emailSentCount++;
      }

      // Send push notification (only if enough cards are due)
      if (dueCount >= MIN_CARDS_FOR_PUSH) {
        const streakText = streak?.currentStreak
          ? ` (serie de ${streak.currentStreak} jours)`
          : '';
        const pushResult = await sendPushToUser(
          settings.userId,
          'Tes connaissances t\'attendent !',
          `${dueCount} cartes a reviser aujourd'hui${streakText}`,
          { screen: '/(tabs)/reviews' }
        );
        if (pushResult.sent > 0) {
          pushSentCount++;
        }
      }
    }

    // ========================================
    // Part 2: Inactivity win-back (J+3)
    // ========================================

    const inactivityThreshold = new Date();
    inactivityThreshold.setDate(inactivityThreshold.getDate() - INACTIVITY_DAYS);

    // Find users who have push tokens but haven't reviewed in 3+ days
    // Only send once per inactivity period (check last review is between 3-4 days ago
    // to avoid re-sending every 5 minutes)
    const inactivityWindowStart = new Date();
    inactivityWindowStart.setDate(inactivityWindowStart.getDate() - (INACTIVITY_DAYS + 1));

    const inactiveUsers = await prisma.$queryRaw<{ userId: string; dueCount: bigint; lastReview: Date }[]>`
      SELECT
        u."id" as "userId",
        (SELECT COUNT(*) FROM "Card" c WHERE c."userId" = u."id" AND c."nextReviewAt" <= NOW()) as "dueCount",
        (SELECT MAX(r."createdAt") FROM "Review" r WHERE r."userId" = u."id") as "lastReview"
      FROM "User" u
      WHERE EXISTS (SELECT 1 FROM "PushToken" pt WHERE pt."userId" = u."id")
      AND (
        SELECT MAX(r."createdAt") FROM "Review" r WHERE r."userId" = u."id"
      ) BETWEEN ${inactivityWindowStart} AND ${inactivityThreshold}
    `;

    for (const { userId, dueCount } of inactiveUsers) {
      const cardCount = Number(dueCount);
      const body = cardCount > 0
        ? `${cardCount} cartes t'attendent. Reprends la ou tu t'es arrete !`
        : 'Tes connaissances ont besoin de toi. Une petite session ?';

      const pushResult = await sendPushToUser(
        userId,
        'Ca fait un moment !',
        body,
        { screen: '/(tabs)/reviews' }
      );
      if (pushResult.sent > 0) {
        inactivitySentCount++;
      }
    }

    log.info({
      emailSent: emailSentCount,
      pushSent: pushSentCount,
      inactivitySent: inactivitySentCount,
    }, 'Reminders completed');
  } catch (error) {
    log.error({ err: error }, 'Worker error');
  }
}

/**
 * Send a test reminder to a specific user (for testing)
 */
export async function sendTestReminder(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      settings: true,
    },
  });

  if (!user) {
    log.error({ userId }, 'User not found');
    return false;
  }

  const [dueCount, streak] = await Promise.all([
    prisma.card.count({
      where: {
        userId,
        nextReviewAt: { lte: new Date() },
      },
    }),
    prisma.streak.findUnique({
      where: { userId },
    }),
  ]);

  // Send both email and push for test
  const emailResult = await sendDailyReminder({
    email: user.email,
    userName: user.name || '',
    dueCount,
    currentStreak: streak?.currentStreak || 0,
  });

  const pushResult = await sendPushToUser(
    userId,
    'Test notification Ankora',
    `${dueCount} cartes a reviser. Streak: ${streak?.currentStreak || 0} jours`,
    { screen: '/(tabs)/reviews' }
  );

  return emailResult || pushResult.sent > 0;
}
