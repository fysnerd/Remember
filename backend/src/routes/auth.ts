import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { Resend } from 'resend';
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

// Apple JWKS for identity token verification
const APPLE_JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

// Resend client for magic link emails
const resend = config.email.resendApiKey ? new Resend(config.email.resendApiKey) : null;

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

// Standard user select fields for auth responses
const userSelectFields = {
  id: true,
  email: true,
  name: true,
  firstName: true,
  plan: true,
  trialEndsAt: true,
  onboardingCompleted: true,
  onboardingStep: true,
} as const;

/**
 * Find or create user from social auth provider
 */
async function findOrCreateSocialUser(opts: {
  provider: 'apple' | 'google';
  providerId: string;
  email: string;
  name?: string;
}): Promise<{ user: any; isNewUser: boolean }> {
  const { provider, providerId, email, name } = opts;
  const providerField = provider === 'apple' ? 'appleUserId' : 'googleId';

  // 1. Find by provider ID
  let user = await prisma.user.findUnique({
    where: { [providerField]: providerId } as any,
    select: userSelectFields,
  });
  if (user) {
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return { user, isNewUser: false };
  }

  // 2. Find by email -> link provider
  user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { [providerField]: providerId, authProvider: provider, lastLoginAt: new Date() },
      select: userSelectFields,
    });
    return { user: updated, isNewUser: false };
  }

  // 3. Create new user
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);

  const newUser = await prisma.user.create({
    data: {
      email,
      name,
      [providerField]: providerId,
      authProvider: provider,
      trialEndsAt,
      lastLoginAt: new Date(),
      settings: { create: {} },
    },
    select: userSelectFields,
  });
  return { user: newUser, isNewUser: true };
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
        authProvider: 'email',
        trialEndsAt,
        settings: {
          create: {}, // Create default settings
        },
      },
      select: userSelectFields,
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

    // Re-fetch with standard fields
    const userResponse = await prisma.user.findUnique({
      where: { id: user.id },
      select: userSelectFields,
    });

    return res.json({
      user: userResponse,
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
        firstName: true,
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
// Social Auth Endpoints
// ============================================================================

// POST /api/auth/apple
const appleSchema = z.object({
  identityToken: z.string(),
  fullName: z.object({
    givenName: z.string().nullable().optional(),
    familyName: z.string().nullable().optional(),
  }).optional(),
});

authRouter.post('/apple', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { identityToken, fullName } = appleSchema.parse(req.body);

    // Verify Apple identity token via JWKS
    const { payload } = await jwtVerify(identityToken, APPLE_JWKS, {
      issuer: 'https://appleid.apple.com',
      audience: config.apple.bundleId,
    });

    const appleUserId = payload.sub;
    const email = payload.email as string;

    if (!appleUserId || !email) {
      throw new AppError(400, 'Invalid Apple identity token');
    }

    const name = fullName?.givenName
      ? `${fullName.givenName}${fullName.familyName ? ' ' + fullName.familyName : ''}`
      : undefined;

    const { user, isNewUser } = await findOrCreateSocialUser({
      provider: 'apple',
      providerId: appleUserId,
      email,
      name,
    });

    const tokens = generateTokens({ id: user.id, email: user.email });
    syncUserPlatforms(user.id);

    return res.status(isNewUser ? 201 : 200).json({ user, ...tokens });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error({ err: error }, 'Apple auth failed');
    return next(error);
  }
});

// POST /api/auth/google
const googleSchema = z.object({
  idToken: z.string(),
});

authRouter.post('/google', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { idToken } = googleSchema.parse(req.body);

    // Verify Google ID token via Google's tokeninfo endpoint
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
    if (!response.ok) {
      throw new AppError(401, 'Invalid Google ID token');
    }

    const payload = await response.json() as { sub: string; email: string; name?: string; given_name?: string };

    if (!payload.sub || !payload.email) {
      throw new AppError(400, 'Invalid Google token payload');
    }

    const { user, isNewUser } = await findOrCreateSocialUser({
      provider: 'google',
      providerId: payload.sub,
      email: payload.email,
      name: payload.name || payload.given_name,
    });

    const tokens = generateTokens({ id: user.id, email: user.email });
    syncUserPlatforms(user.id);

    return res.status(isNewUser ? 201 : 200).json({ user, ...tokens });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error({ err: error }, 'Google auth failed');
    return next(error);
  }
});

// POST /api/auth/magic-link
const magicLinkSchema = z.object({
  email: z.string().email(),
});

authRouter.post('/magic-link', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = magicLinkSchema.parse(req.body);

    if (!resend) {
      throw new AppError(503, 'Email service not configured');
    }

    // Generate a secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store token
    await prisma.magicLinkToken.create({
      data: { email: email.toLowerCase(), token, expiresAt },
    });

    // Build magic link URL (deep link for mobile)
    const magicLinkUrl = `ankora://auth/verify?token=${token}&email=${encodeURIComponent(email.toLowerCase())}`;
    const webFallbackUrl = `${config.magicLink.baseUrl}/api/auth/magic-link/redirect?token=${token}&email=${encodeURIComponent(email.toLowerCase())}`;

    // Send email
    await resend.emails.send({
      from: config.email.from,
      to: email.toLowerCase(),
      subject: 'Connexion à Ankora',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="font-size: 24px; color: #F8FAFC; text-align: center;">Ankora</h1>
          <p style="color: #94A3B8; text-align: center; font-size: 16px;">Clique sur le bouton pour te connecter.</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${magicLinkUrl}" style="background: #D4A574; color: #0A0F1A; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
              Se connecter
            </a>
          </div>
          <p style="color: #64748B; text-align: center; font-size: 13px;">
            Si le bouton ne fonctionne pas, <a href="${webFallbackUrl}" style="color: #D4A574;">clique ici</a>.
          </p>
          <p style="color: #64748B; text-align: center; font-size: 12px; margin-top: 24px;">Ce lien expire dans 15 minutes.</p>
        </div>
      `,
    });

    return res.json({ message: 'Magic link sent' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error({ err: error }, 'Magic link send failed');
    return next(error);
  }
});

// GET /api/auth/magic-link/redirect — web fallback that redirects to deep link
authRouter.get('/magic-link/redirect', (req: Request, res: Response) => {
  const { token, email } = req.query;
  const deepLink = `ankora://auth/verify?token=${token}&email=${email}`;
  res.send(`
    <html><head><meta http-equiv="refresh" content="0;url=${deepLink}" /></head>
    <body style="background:#0A0F1A;color:#F8FAFC;font-family:sans-serif;text-align:center;padding-top:100px;">
      <p>Redirection vers Ankora...</p>
      <p><a href="${deepLink}" style="color:#D4A574;">Clique ici si rien ne se passe</a></p>
    </body></html>
  `);
});

// POST /api/auth/verify-magic-link
const verifyMagicLinkSchema = z.object({
  token: z.string(),
  email: z.string().email(),
});

authRouter.post('/verify-magic-link', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, email } = verifyMagicLinkSchema.parse(req.body);

    // Find and validate token
    const magicToken = await prisma.magicLinkToken.findUnique({ where: { token } });

    if (!magicToken || magicToken.email !== email.toLowerCase()) {
      throw new AppError(401, 'Invalid or expired magic link');
    }
    if (magicToken.usedAt) {
      throw new AppError(401, 'Magic link already used');
    }
    if (magicToken.expiresAt < new Date()) {
      throw new AppError(401, 'Magic link expired');
    }

    // Mark token as used
    await prisma.magicLinkToken.update({
      where: { id: magicToken.id },
      data: { usedAt: new Date() },
    });

    // Find or create user
    let user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    let isNewUser = false;

    if (!user) {
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);

      user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          emailVerified: true,
          authProvider: 'email',
          trialEndsAt,
          lastLoginAt: new Date(),
          settings: { create: {} },
        },
      });
      isNewUser = true;
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true, lastLoginAt: new Date() },
      });
    }

    const tokens = generateTokens({ id: user.id, email: user.email });
    syncUserPlatforms(user.id);

    const userResponse = {
      id: user.id,
      email: user.email,
      name: user.name,
      firstName: (user as any).firstName,
      plan: user.plan,
      trialEndsAt: user.trialEndsAt,
      onboardingCompleted: (user as any).onboardingCompleted,
      onboardingStep: (user as any).onboardingStep,
    };

    return res.status(isNewUser ? 201 : 200).json({ user: userResponse, ...tokens });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error({ err: error }, 'Magic link verification failed');
    return next(error);
  }
});

// POST /api/auth/logout
authRouter.post('/logout', authenticateToken, (_req: Request, res: Response) => {
  // In a more complete implementation, we'd invalidate the refresh token
  // For now, the client just deletes the tokens locally
  res.json({ message: 'Logged out successfully' });
});
