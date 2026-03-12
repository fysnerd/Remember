// Push notification token registration routes
import { Router, Request, Response } from 'express';
import { prisma } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { logger } from '../config/logger.js';

const log = logger.child({ component: 'notifications-route' });

export const notificationRouter = Router();

// All routes require auth
notificationRouter.use(authenticateToken);

/**
 * POST /api/notifications/push-token
 * Register or update an Expo push token for the current user
 */
notificationRouter.post('/push-token', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { token, deviceId } = req.body;

    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'Push token is required' });
      return;
    }

    // A physical device can only belong to one user at a time.
    // Remove this token from any other user before registering.
    await prisma.pushToken.deleteMany({
      where: { token, NOT: { userId } },
    });

    // Upsert: if this user+token combo exists, update it; otherwise create
    await prisma.pushToken.upsert({
      where: {
        userId_token: { userId, token },
      },
      update: {
        deviceId: deviceId || null,
        updatedAt: new Date(),
      },
      create: {
        userId,
        token,
        deviceId: deviceId || null,
      },
    });

    log.info({ userId, hasDeviceId: !!deviceId }, 'Push token registered');
    res.json({ success: true });
  } catch (error) {
    log.error({ err: error }, 'Failed to register push token');
    res.status(500).json({ error: 'Failed to register push token' });
  }
});

/**
 * DELETE /api/notifications/push-token
 * Unregister a push token (e.g., on logout)
 */
notificationRouter.delete('/push-token', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'Push token is required' });
      return;
    }

    await prisma.pushToken.deleteMany({
      where: { userId, token },
    });

    log.info({ userId }, 'Push token unregistered');
    res.json({ success: true });
  } catch (error) {
    log.error({ err: error }, 'Failed to unregister push token');
    res.status(500).json({ error: 'Failed to unregister push token' });
  }
});
