// Push Notification Service - Expo Push API wrapper
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';

const log = logger.child({ component: 'push-notifications' });

const expo = new Expo();

/**
 * Send push notifications to a user's devices
 * Automatically cleans up invalid tokens (DeviceNotRegistered)
 */
export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<{ sent: number; failed: number }> {
  const tokens = await prisma.pushToken.findMany({
    where: { userId },
    select: { id: true, token: true },
  });

  if (tokens.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const messages: ExpoPushMessage[] = [];
  const tokenMap = new Map<string, string>(); // token -> pushToken.id

  for (const { id, token } of tokens) {
    if (!Expo.isExpoPushToken(token)) {
      log.warn({ userId, token }, 'Invalid Expo push token, removing');
      await prisma.pushToken.delete({ where: { id } }).catch(() => {});
      continue;
    }
    messages.push({ to: token, title, body, data, sound: 'default' });
    tokenMap.set(token, id);
  }

  if (messages.length === 0) {
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  const tokensToRemove: string[] = [];

  try {
    const chunks = expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      const tickets: ExpoPushTicket[] = await expo.sendPushNotificationsAsync(chunk);

      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        const pushToken = (chunk[i] as ExpoPushMessage).to as string;

        if (ticket.status === 'ok') {
          sent++;
        } else {
          failed++;
          // Clean up tokens that are no longer valid
          if (ticket.details?.error === 'DeviceNotRegistered') {
            const tokenId = tokenMap.get(pushToken);
            if (tokenId) tokensToRemove.push(tokenId);
          }
          log.warn({ userId, error: ticket.details?.error }, 'Push notification failed');
        }
      }
    }
  } catch (error) {
    log.error({ userId, err: error }, 'Failed to send push notifications');
    failed = messages.length;
  }

  // Clean up invalid tokens
  if (tokensToRemove.length > 0) {
    await prisma.pushToken.deleteMany({
      where: { id: { in: tokensToRemove } },
    }).catch(() => {});
    log.info({ userId, count: tokensToRemove.length }, 'Removed invalid push tokens');
  }

  return { sent, failed };
}

/**
 * Send push notifications to multiple users at once
 */
export async function sendPushToUsers(
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<{ totalSent: number; totalFailed: number }> {
  let totalSent = 0;
  let totalFailed = 0;

  for (const userId of userIds) {
    const result = await sendPushToUser(userId, title, body, data);
    totalSent += result.sent;
    totalFailed += result.failed;
  }

  return { totalSent, totalFailed };
}
