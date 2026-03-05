// Daily Review Reminder Worker
// Sends ONE push notification per day about the user's daily subjects (not raw card counts)
import { logger } from '../config/logger.js';
import { prisma } from '../config/database.js';
import { sendPushToUser } from '../services/pushNotifications.js';
import { generateRecommendations } from '../routes/home.js';

const log = logger.child({ job: 'reminder' });

// Days of inactivity before sending win-back notification
const INACTIVITY_DAYS = 3;

/**
 * Check if it's time to send a reminder for a user based on their settings.
 * Tight ±2 minute window to avoid duplicate sends across cron cycles.
 */
function isReminderTime(reminderTime: string, timezone: string): boolean {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const currentTime = formatter.format(now);

    const [reminderHour, reminderMinute] = reminderTime.split(':').map(Number);
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);

    const reminderMinutes = reminderHour * 60 + reminderMinute;
    const currentMinutes = currentHour * 60 + currentMinute;

    return Math.abs(currentMinutes - reminderMinutes) <= 2;
  } catch {
    return false;
  }
}

/**
 * Get today's date string in user's timezone (YYYY-MM-DD)
 */
function getUserTodayDate(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(new Date());
  }
}

/**
 * Check if a push was already sent today for this user (dedup)
 */
function alreadySentToday(lastPushSentAt: Date | null, timezone: string): boolean {
  if (!lastPushSentAt) return false;
  const todayStr = getUserTodayDate(timezone);
  let sentStr: string;
  try {
    sentStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(lastPushSentAt);
  } catch {
    sentStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(lastPushSentAt);
  }
  return sentStr === todayStr;
}

/**
 * Build a notification message from the user's daily recommendations.
 * Returns { title, body } or null if nothing to notify about.
 */
async function buildSubjectNotification(
  userId: string,
  timezone: string,
  streak: number,
): Promise<{ title: string; body: string } | null> {
  const todayStr = getUserTodayDate(timezone);
  const todayDate = new Date(todayStr + 'T00:00:00Z');

  // Check for existing daily recommendations
  let dailyRecs = await prisma.dailyRecommendation.findMany({
    where: { userId, date: todayDate },
    orderBy: { slot: 'asc' },
  });

  // Generate if they don't exist yet (worker may run before user opens app)
  if (dailyRecs.length === 0) {
    const freshRecs = await generateRecommendations(userId);
    if (freshRecs.length > 0) {
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
      dailyRecs = await prisma.dailyRecommendation.findMany({
        where: { userId, date: todayDate },
        orderBy: { slot: 'asc' },
      });
    }
  }

  if (dailyRecs.length === 0) return null;

  // Check how many are already completed
  const remaining = dailyRecs.filter(r => !r.completedAt);
  if (remaining.length === 0) return null; // All done today

  // Fetch subject names for the notification
  const subjectNames: string[] = [];
  for (const rec of remaining.slice(0, 3)) {
    if (rec.targetType === 'content') {
      const content = await prisma.content.findUnique({
        where: { id: rec.targetId },
        select: { title: true },
      });
      if (content) {
        // Truncate long titles
        const name = content.title.length > 40
          ? content.title.substring(0, 37) + '...'
          : content.title;
        subjectNames.push(name);
      }
    } else {
      const theme = await prisma.theme.findUnique({
        where: { id: rec.targetId },
        select: { name: true, emoji: true },
      });
      if (theme) {
        subjectNames.push(theme.emoji ? `${theme.emoji} ${theme.name}` : theme.name);
      }
    }
  }

  if (subjectNames.length === 0) return null;

  const streakSuffix = streak > 1 ? ` | ${streak}j` : '';
  const count = remaining.length;

  // Build engaging message
  let title: string;
  let body: string;

  if (count === 1) {
    title = 'Un sujet t\'attend aujourd\'hui';
    body = `${subjectNames[0]}${streakSuffix}`;
  } else {
    title = `${count} sujets a reviser aujourd'hui`;
    if (subjectNames.length <= 2) {
      body = `${subjectNames.join(' et ')}${streakSuffix}`;
    } else {
      body = `${subjectNames.slice(0, 2).join(', ')} et +${count - 2}${streakSuffix}`;
    }
  }

  return { title, body };
}

/**
 * Run the daily reminder worker.
 * Called every 5 minutes by the scheduler.
 * Handles: daily subject notifications (push) and inactivity J+3 win-back (push).
 */
export async function runReminderWorker(): Promise<void> {
  log.info('Starting');

  try {
    let pushSentCount = 0;
    let inactivitySentCount = 0;

    // ========================================
    // Part 1: Daily subject notifications (ONE per day)
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
      // Check if it's the right time for this user (±2 min window)
      if (!isReminderTime(settings.dailyReminderTime, settings.timezone)) {
        continue;
      }

      // Dedup: skip if already sent a push today
      if (alreadySentToday(settings.lastPushSentAt, settings.timezone)) {
        continue;
      }

      // Check streak
      const streak = await prisma.streak.findUnique({
        where: { userId: settings.userId },
      });

      // Build notification from actual daily subjects
      const notification = await buildSubjectNotification(
        settings.userId,
        settings.timezone,
        streak?.currentStreak || 0,
      );

      if (!notification) continue;

      const pushResult = await sendPushToUser(
        settings.userId,
        notification.title,
        notification.body,
        { screen: '/(tabs)' }
      );

      if (pushResult.sent > 0) {
        pushSentCount++;
        // Mark as sent today (dedup)
        await prisma.userSettings.update({
          where: { userId: settings.userId },
          data: { lastPushSentAt: new Date() },
        });
      }
    }

    // ========================================
    // Part 2: Inactivity win-back (J+3)
    // ========================================

    const inactivityThreshold = new Date();
    inactivityThreshold.setDate(inactivityThreshold.getDate() - INACTIVITY_DAYS);

    const inactivityWindowStart = new Date();
    inactivityWindowStart.setDate(inactivityWindowStart.getDate() - (INACTIVITY_DAYS + 1));

    const inactiveUsers = await prisma.$queryRaw<{ userId: string; lastReview: Date }[]>`
      SELECT
        u."id" as "userId",
        (SELECT MAX(r."createdAt") FROM "Review" r WHERE r."userId" = u."id") as "lastReview"
      FROM "User" u
      WHERE EXISTS (SELECT 1 FROM "PushToken" pt WHERE pt."userId" = u."id")
      AND (
        SELECT MAX(r."createdAt") FROM "Review" r WHERE r."userId" = u."id"
      ) BETWEEN ${inactivityWindowStart} AND ${inactivityThreshold}
    `;

    for (const { userId } of inactiveUsers) {
      // Check dedup for inactivity too (uses same lastPushSentAt)
      const userSettings = await prisma.userSettings.findUnique({
        where: { userId },
      });
      if (userSettings && alreadySentToday(userSettings.lastPushSentAt, userSettings.timezone || 'UTC')) {
        continue;
      }

      const pushResult = await sendPushToUser(
        userId,
        'Ca fait un moment !',
        'Tes sujets t\'attendent. Une petite session ?',
        { screen: '/(tabs)' }
      );
      if (pushResult.sent > 0) {
        inactivitySentCount++;
        if (userSettings) {
          await prisma.userSettings.update({
            where: { userId },
            data: { lastPushSentAt: new Date() },
          });
        }
      }
    }

    log.info({
      pushSent: pushSentCount,
      inactivitySent: inactivitySentCount,
    }, 'Reminders completed');
  } catch (error) {
    log.error({ err: error }, 'Worker error');
  }
}
