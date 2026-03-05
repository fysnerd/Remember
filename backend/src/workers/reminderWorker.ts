// Daily Reminder Worker — exactly 2 push notifications per day:
//   1. Morning (user's dailyReminderTime): "Tes 3 sujets du jour sont prets"
//   2. Afternoon (14:00 user time): "Et si tu revisais [random subject] ?"
import { logger } from '../config/logger.js';
import { prisma } from '../config/database.js';
import { sendPushToUser } from '../services/pushNotifications.js';
import { generateRecommendations } from '../routes/home.js';

const log = logger.child({ job: 'reminder' });

const AFTERNOON_HOUR = 14; // 14:00 in user's timezone
const INACTIVITY_DAYS = 3;

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

function isWithinWindow(currentMinutes: number, targetMinutes: number): boolean {
  return Math.abs(currentMinutes - targetMinutes) <= 2;
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
// Get or create today's DailyRecommendation
// ============================================================================

async function ensureDailyRecs(userId: string, timezone: string) {
  const todayStr = getUserTodayDate(timezone);
  const todayDate = new Date(todayStr + 'T00:00:00Z');

  let dailyRecs = await prisma.dailyRecommendation.findMany({
    where: { userId, date: todayDate },
    orderBy: { slot: 'asc' },
  });

  if (dailyRecs.length === 0) {
    const freshRecs = await generateRecommendations(userId);
    if (freshRecs.length > 0) {
      await prisma.dailyRecommendation.createMany({
        data: freshRecs.map((rec, i) => ({
          userId,
          date: todayDate,
          slot: i,
          targetType: rec.type,
          targetId: rec.id,
        })),
        skipDuplicates: true,
      });
      dailyRecs = await prisma.dailyRecommendation.findMany({
        where: { userId, date: todayDate },
        orderBy: { slot: 'asc' },
      });
    }
  }

  return dailyRecs;
}

// ============================================================================
// Fetch a subject name from a DailyRecommendation row
// ============================================================================

async function getSubjectName(rec: { targetType: string; targetId: string }): Promise<string | null> {
  if (rec.targetType === 'content') {
    const c = await prisma.content.findUnique({
      where: { id: rec.targetId },
      select: { title: true },
    });
    if (!c) return null;
    return c.title.length > 45 ? c.title.substring(0, 42) + '...' : c.title;
  } else {
    const t = await prisma.theme.findUnique({
      where: { id: rec.targetId },
      select: { name: true, emoji: true },
    });
    if (!t) return null;
    return t.emoji ? `${t.emoji} ${t.name}` : t.name;
  }
}

// ============================================================================
// Main worker
// ============================================================================

export async function runReminderWorker(): Promise<void> {
  log.info('Starting');

  try {
    let morningSent = 0;
    let afternoonSent = 0;
    let inactivitySent = 0;

    const usersWithSettings = await prisma.userSettings.findMany({
      where: { emailReminders: true },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });

    for (const settings of usersWithSettings) {
      const tz = settings.timezone || 'UTC';
      const { hour, minute } = getUserCurrentTime(tz);
      const currentMinutes = hour * 60 + minute;

      const [reminderH, reminderM] = settings.dailyReminderTime.split(':').map(Number);
      const morningTarget = reminderH * 60 + reminderM;
      const afternoonTarget = AFTERNOON_HOUR * 60; // 14:00

      // ── Notif 1: Morning — announce daily subjects ──
      if (isWithinWindow(currentMinutes, morningTarget) && !wasSentToday(settings.lastPushSentAt, tz)) {
        const dailyRecs = await ensureDailyRecs(settings.userId, tz);
        if (dailyRecs.length > 0) {
          const names: string[] = [];
          for (const rec of dailyRecs) {
            const name = await getSubjectName(rec);
            if (name) names.push(name);
          }

          if (names.length > 0) {
            const count = names.length;
            const title = count === 1
              ? 'Ton sujet du jour est pret !'
              : `Tes ${count} sujets du jour sont prets !`;
            const body = names.length <= 2
              ? names.join(' et ')
              : `${names.slice(0, 2).join(', ')} et ${names[names.length - 1]}`;

            const result = await sendPushToUser(settings.userId, title, body, { screen: '/(tabs)' });
            if (result.sent > 0) {
              morningSent++;
              await prisma.userSettings.update({
                where: { userId: settings.userId },
                data: { lastPushSentAt: new Date() },
              });
            }
          }
        }
      }

      // ── Notif 2: Afternoon — nudge with one random remaining subject ──
      if (isWithinWindow(currentMinutes, afternoonTarget) && !wasSentToday(settings.afternoonPushSentAt, tz)) {
        const dailyRecs = await ensureDailyRecs(settings.userId, tz);
        const remaining = dailyRecs.filter(r => !r.completedAt);

        if (remaining.length > 0) {
          // Pick a random remaining subject
          const pick = remaining[Math.floor(Math.random() * remaining.length)];
          const name = await getSubjectName(pick);

          if (name) {
            const title = 'Et si tu revisais un sujet ?';
            const body = name;

            const result = await sendPushToUser(settings.userId, title, body, { screen: '/(tabs)' });
            if (result.sent > 0) {
              afternoonSent++;
              await prisma.userSettings.update({
                where: { userId: settings.userId },
                data: { afternoonPushSentAt: new Date() },
              });
            }
          }
        }
      }
    }

    // ── Inactivity win-back (J+3) ──
    const inactivityThreshold = new Date();
    inactivityThreshold.setDate(inactivityThreshold.getDate() - INACTIVITY_DAYS);
    const inactivityWindowStart = new Date();
    inactivityWindowStart.setDate(inactivityWindowStart.getDate() - (INACTIVITY_DAYS + 1));

    const inactiveUsers = await prisma.$queryRaw<{ userId: string }[]>`
      SELECT u."id" as "userId"
      FROM "User" u
      WHERE EXISTS (SELECT 1 FROM "PushToken" pt WHERE pt."userId" = u."id")
      AND (
        SELECT MAX(r."createdAt") FROM "Review" r WHERE r."userId" = u."id"
      ) BETWEEN ${inactivityWindowStart} AND ${inactivityThreshold}
    `;

    for (const { userId } of inactiveUsers) {
      const us = await prisma.userSettings.findUnique({ where: { userId } });
      if (us && wasSentToday(us.lastPushSentAt, us.timezone || 'UTC')) continue;

      const result = await sendPushToUser(
        userId,
        'Ca fait un moment !',
        'Tes sujets t\'attendent. Une petite session ?',
        { screen: '/(tabs)' }
      );
      if (result.sent > 0) {
        inactivitySent++;
        if (us) {
          await prisma.userSettings.update({
            where: { userId },
            data: { lastPushSentAt: new Date() },
          });
        }
      }
    }

    log.info({ morningSent, afternoonSent, inactivitySent }, 'Reminders completed');
  } catch (error) {
    log.error({ err: error }, 'Worker error');
  }
}
