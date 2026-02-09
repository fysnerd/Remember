// Daily Review Reminder Worker (S010)
import { logger } from '../config/logger.js';
import { prisma } from '../config/database.js';
import { sendDailyReminder } from '../services/email.js';

const log = logger.child({ job: 'reminder' });

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
 */
export async function runReminderWorker(): Promise<void> {
  log.info('Starting');

  try {
    // Get all users with email reminders enabled
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

    let sentCount = 0;

    for (const settings of usersWithSettings) {
      // Check if it's the right time for this user
      if (!isReminderTime(settings.dailyReminderTime, settings.timezone)) {
        continue;
      }

      // Check if we already sent a reminder today (to avoid duplicates)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Use a simple cache key approach - check if user was reminded today
      // In production, you'd use Redis or a dedicated table for this
      const lastReminder = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count FROM "Review"
        WHERE "userId" = ${settings.userId}
        AND "createdAt" >= ${today}
      `;

      // Skip if user has already reviewed today (they don't need a reminder)
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

      // Send the reminder
      const success = await sendDailyReminder({
        email: settings.user.email,
        userName: settings.user.name || '',
        dueCount,
        currentStreak: streak?.currentStreak || 0,
      });

      if (success) {
        sentCount++;
      }
    }

    log.info({ sentCount }, 'Reminders sent');
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

  return sendDailyReminder({
    email: user.email,
    userName: user.name || '',
    dueCount,
    currentStreak: streak?.currentStreak || 0,
  });
}
