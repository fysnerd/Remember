import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { config } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import { generateTokens, authenticateToken, JwtPayload } from '../middleware/auth.js';
import { Platform } from '@prisma/client';
import { syncUserYouTube } from '../workers/youtubeSync.js';
import { syncUserSpotify } from '../workers/spotifySync.js';
import { syncTikTokForUser } from '../workers/tiktokSync.js';
import { logger } from '../config/logger.js';

const log = logger.child({ route: 'auth' });

export const authRouter = Router();

/**
 * Sync all connected platforms for a user (non-blocking background task)
 */
async function syncUserPlatforms(userId: string): Promise<void> {
  try {
    const connections = await prisma.connectedPlatform.findMany({
      where: { userId },
    });

    for (const connection of connections) {
      if (connection.platform === Platform.YOUTUBE) {
        syncUserYouTube(userId, connection.id).catch((error) => {
          log.error({ err: error, userId, platform: 'youtube' }, 'Background sync failed on login');
        });
      } else if (connection.platform === Platform.SPOTIFY) {
        syncUserSpotify(userId, connection.id).catch((error) => {
          log.error({ err: error, userId, platform: 'spotify' }, 'Background sync failed on login');
        });
      } else if (connection.platform === Platform.TIKTOK) {
        syncTikTokForUser(userId).catch((error) => {
          log.error({ err: error, userId, platform: 'tiktok' }, 'Background sync failed on login');
        });
      }
    }

    if (connections.length > 0) {
      log.info({ userId, platformCount: connections.length }, 'Background sync triggered on login');
    }
  } catch (error) {
    log.error({ err: error, userId }, 'Failed to trigger platform sync on login');
  }
}

// Validation schemas
const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// POST /api/auth/signup
authRouter.post('/signup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = signupSchema.parse(req.body);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new AppError(409, 'Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Create user with 14-day trial
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
        trialEndsAt,
        settings: {
          create: {}, // Create default settings
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        trialEndsAt: true,
        createdAt: true,
      },
    });

    // Generate tokens
    const tokens = generateTokens({ id: user.id, email: user.email });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return res.status(201).json({
      user,
      ...tokens,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }
    return next(error);
  }
});

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = loginSchema.parse(req.body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user || !user.passwordHash) {
      throw new AppError(401, 'Invalid email or password');
    }

    // Verify password
    const isValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValid) {
      throw new AppError(401, 'Invalid email or password');
    }

    // Generate tokens
    const tokens = generateTokens({ id: user.id, email: user.email });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Trigger background sync of all connected platforms (non-blocking)
    syncUserPlatforms(user.id);

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        trialEndsAt: user.trialEndsAt,
      },
      ...tokens,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }
    return next(error);
  }
});

// POST /api/auth/refresh
authRouter.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AppError(400, 'Refresh token required');
    }

    // Verify refresh token
    const payload = jwt.verify(refreshToken, config.jwt.refreshSecret) as JwtPayload;

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new AppError(401, 'User not found');
    }

    // Generate new tokens
    const tokens = generateTokens(user);

    return res.json(tokens);
  } catch (error) {
    return next(error);
  }
});

// GET /api/auth/me
authRouter.get('/me', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        plan: true,
        trialEndsAt: true,
        emailVerified: true,
        createdAt: true,
        connectedPlatforms: {
          select: {
            platform: true,
            lastSyncAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    return res.json({ user });
  } catch (error) {
    return next(error);
  }
});

// POST /api/auth/logout
authRouter.post('/logout', authenticateToken, (_req: Request, res: Response) => {
  // In a more complete implementation, we'd invalidate the refresh token
  // For now, the client just deletes the tokens locally
  res.json({ message: 'Logged out successfully' });
});
