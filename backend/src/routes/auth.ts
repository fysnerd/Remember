import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
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
import jwksClient from 'jwks-rsa';
import { Resend } from 'resend';
import axios from 'axios';

const log = logger.child({ route: 'auth' });

// Apple JWKS client for token verification
const appleJwksClient = jwksClient({
  jwksUri: 'https://appleid.apple.com/auth/keys',
  cache: true,
  cacheMaxAge: 86400000, // 24h
});

// Resend email client (lazy init)
const getResend = () => {
  if (!config.email.resendApiKey) return null;
  return new Resend(config.email.resendApiKey);
};

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
        onboardingCompleted: user.onboardingCompleted,
        onboardingStep: user.onboardingStep,
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
        onboardingCompleted: true,
        onboardingStep: true,
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

// ============================================================================
// Apple Sign In
// ============================================================================

const appleAuthSchema = z.object({
  identityToken: z.string(),
  firstName: z.string().optional(),
  email: z.string().email().optional(),
});

authRouter.post('/apple', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = appleAuthSchema.parse(req.body);

    // Decode JWT header to get kid
    const tokenParts = data.identityToken.split('.');
    const header = JSON.parse(Buffer.from(tokenParts[0], 'base64').toString());

    // Get signing key from Apple JWKS
    const key = await appleJwksClient.getSigningKey(header.kid);
    const signingKey = key.getPublicKey();

    // Verify Apple identity token
    const decoded = jwt.verify(data.identityToken, signingKey, {
      algorithms: ['RS256'],
      issuer: 'https://appleid.apple.com',
      audience: config.apple.bundleId,
    }) as { sub: string; email?: string };

    const appleUserId = decoded.sub;
    const email = decoded.email || data.email;

    if (!email) {
      throw new AppError(400, 'Email is required for Apple Sign In');
    }

    // Find existing user by appleUserId or email
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { appleUserId },
          { email },
        ],
      },
    });

    let isNewUser = false;

    if (user) {
      // Link appleUserId if not already set
      if (!user.appleUserId) {
        await prisma.user.update({
          where: { id: user.id },
          data: { appleUserId, authProvider: 'apple' },
        });
      }
      // Update name if provided and not set
      if (data.firstName && !user.name) {
        await prisma.user.update({
          where: { id: user.id },
          data: { name: data.firstName },
        });
      }
    } else {
      // Create new user
      isNewUser = true;
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);

      user = await prisma.user.create({
        data: {
          email,
          name: data.firstName,
          appleUserId,
          authProvider: 'apple',
          emailVerified: true,
          trialEndsAt,
          settings: { create: {} },
        },
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = generateTokens({ id: user.id, email: user.email });

    if (!isNewUser) {
      syncUserPlatforms(user.id);
    }

    return res.json({
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        onboardingCompleted: user.onboardingCompleted,
        onboardingStep: user.onboardingStep,
      },
      isNewUser,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error({ err: error }, 'Apple auth failed');
    return next(error);
  }
});

// ============================================================================
// Google Sign In (from mobile id_token)
// ============================================================================

const googleAuthSchema = z.object({
  idToken: z.string(),
  firstName: z.string().optional(),
});

authRouter.post('/google', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = googleAuthSchema.parse(req.body);

    // Verify Google ID token
    const tokenInfoRes = await axios.get(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${data.idToken}`
    );
    const { email, sub: googleUserId, name: googleName } = tokenInfoRes.data;

    if (!email) {
      throw new AppError(400, 'Email is required for Google Sign In');
    }

    // Find existing user by email
    let user = await prisma.user.findUnique({ where: { email } });
    let isNewUser = false;

    if (user) {
      // Update name if not set
      if ((data.firstName || googleName) && !user.name) {
        await prisma.user.update({
          where: { id: user.id },
          data: { name: data.firstName || googleName },
        });
      }
    } else {
      isNewUser = true;
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);

      user = await prisma.user.create({
        data: {
          email,
          name: data.firstName || googleName,
          authProvider: 'google',
          emailVerified: true,
          trialEndsAt,
          settings: { create: {} },
        },
      });

      // Also create OAuthAccount for tracking
      await prisma.oAuthAccount.create({
        data: {
          userId: user.id,
          provider: 'google',
          providerAccountId: googleUserId,
        },
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = generateTokens({ id: user.id, email: user.email });

    if (!isNewUser) {
      syncUserPlatforms(user.id);
    }

    return res.json({
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        onboardingCompleted: user.onboardingCompleted,
        onboardingStep: user.onboardingStep,
      },
      isNewUser,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error({ err: error }, 'Google auth failed');
    return next(error);
  }
});

// ============================================================================
// Magic Link - Send
// ============================================================================

const magicLinkSendSchema = z.object({
  email: z.string().email(),
});

authRouter.post('/magic-link/send', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = magicLinkSendSchema.parse(req.body);

    // Rate limit: max 3 per email per 15 min
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    const recentCount = await prisma.magicLinkToken.count({
      where: {
        email: data.email,
        createdAt: { gte: fifteenMinAgo },
      },
    });

    if (recentCount >= 3) {
      throw new AppError(429, 'Trop de demandes. Réessaie dans quelques minutes.');
    }

    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    await prisma.magicLinkToken.create({
      data: {
        email: data.email,
        token,
        expiresAt,
      },
    });

    // Send email
    const resend = getResend();
    if (resend) {
      const magicLink = `ankora://magic-link?token=${token}&email=${encodeURIComponent(data.email)}`;
      await resend.emails.send({
        from: 'Ankora <noreply@ankora.study>',
        to: data.email,
        subject: 'Ton lien de connexion Ankora',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
            <h1 style="color: #F8FAFC; font-size: 24px;">Ankora</h1>
            <p style="color: #94A3B8; font-size: 16px; line-height: 1.6;">
              Clique sur le bouton ci-dessous pour te connecter. Ce lien expire dans 15 minutes.
            </p>
            <a href="${magicLink}" style="display: inline-block; background: #6366F1; color: white; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px; margin: 24px 0;">
              Se connecter
            </a>
            <p style="color: #64748B; font-size: 13px; margin-top: 32px;">
              Si tu n'as pas demandé ce lien, ignore cet email.
            </p>
          </div>
        `,
      });
      log.info({ email: data.email }, 'Magic link email sent');
    } else {
      log.warn('Resend API key not configured, magic link not sent');
      log.info({ email: data.email, token }, 'Magic link token (no email sent)');
    }

    return res.json({ message: 'Lien envoyé ! Vérifie ta boîte mail.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    return next(error);
  }
});

// ============================================================================
// Magic Link - Verify
// ============================================================================

const magicLinkVerifySchema = z.object({
  token: z.string(),
  email: z.string().email(),
});

authRouter.post('/magic-link/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = magicLinkVerifySchema.parse(req.body);

    // Find valid token
    const magicToken = await prisma.magicLinkToken.findUnique({
      where: { token: data.token },
    });

    if (!magicToken) {
      throw new AppError(400, 'Lien invalide');
    }

    if (magicToken.email !== data.email) {
      throw new AppError(400, 'Lien invalide');
    }

    if (magicToken.usedAt) {
      throw new AppError(400, 'Ce lien a déjà été utilisé');
    }

    if (magicToken.expiresAt < new Date()) {
      throw new AppError(400, 'Ce lien a expiré. Demande un nouveau lien.');
    }

    // Mark token as used
    await prisma.magicLinkToken.update({
      where: { id: magicToken.id },
      data: { usedAt: new Date() },
    });

    // Find or create user
    let user = await prisma.user.findUnique({ where: { email: data.email } });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);

      user = await prisma.user.create({
        data: {
          email: data.email,
          authProvider: 'email',
          emailVerified: true,
          trialEndsAt,
          settings: { create: {} },
        },
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = generateTokens({ id: user.id, email: user.email });

    if (!isNewUser) {
      syncUserPlatforms(user.id);
    }

    return res.json({
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        onboardingCompleted: user.onboardingCompleted,
        onboardingStep: user.onboardingStep,
      },
      isNewUser,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    return next(error);
  }
});

// POST /api/auth/logout
authRouter.post('/logout', authenticateToken, (_req: Request, res: Response) => {
  // In a more complete implementation, we'd invalidate the refresh token
  // For now, the client just deletes the tokens locally
  res.json({ message: 'Logged out successfully' });
});
