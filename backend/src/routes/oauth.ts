import { Router, Request, Response, NextFunction } from 'express';
import { config } from '../config/env.js';
import { prisma } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { Platform } from '@prisma/client';

// Token response interface for OAuth providers
interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export const oauthRouter = Router();

// ============================================================================
// YouTube OAuth
// ============================================================================

// GET /api/oauth/youtube/connect - Start YouTube OAuth flow
oauthRouter.get('/youtube/connect', authenticateToken, (req: Request, res: Response) => {
  const state = Buffer.from(JSON.stringify({
    userId: req.user!.id,
    timestamp: Date.now(),
  })).toString('base64');

  const params = new URLSearchParams({
    client_id: config.youtube.clientId,
    redirect_uri: config.youtube.callbackUrl,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/youtube.readonly',
    access_type: 'offline',
    prompt: 'consent', // Force consent to get refresh token
    state,
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  res.json({ authUrl });
});

// GET /api/oauth/youtube/callback - Handle YouTube OAuth callback
oauthRouter.get('/youtube/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      // User denied access or other error
      return res.redirect(`${config.frontendUrl}/settings?error=youtube_denied`);
    }

    if (!code || !state) {
      throw new AppError(400, 'Missing code or state');
    }

    // Decode state to get userId
    const stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
    const userId = stateData.userId;

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.youtube.clientId,
        client_secret: config.youtube.clientSecret,
        code: code as string,
        grant_type: 'authorization_code',
        redirect_uri: config.youtube.callbackUrl,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('YouTube token error:', errorData);
      throw new AppError(500, 'Failed to exchange code for tokens');
    }

    const tokens = await tokenResponse.json() as OAuthTokenResponse;

    // Calculate expiry time
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Store or update connected platform
    await prisma.connectedPlatform.upsert({
      where: {
        userId_platform: {
          userId,
          platform: Platform.YOUTUBE,
        },
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || undefined,
        expiresAt,
        lastSyncError: null,
      },
      create: {
        userId,
        platform: Platform.YOUTUBE,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
        expiresAt,
      },
    });

    // Redirect back to frontend
    res.redirect(`${config.frontendUrl}/settings?youtube=connected`);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/oauth/youtube/disconnect
oauthRouter.delete('/youtube/disconnect', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.connectedPlatform.delete({
      where: {
        userId_platform: {
          userId: req.user!.id,
          platform: Platform.YOUTUBE,
        },
      },
    });

    res.json({ message: 'YouTube disconnected successfully' });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// Spotify OAuth
// ============================================================================

// GET /api/oauth/spotify/connect - Start Spotify OAuth flow
oauthRouter.get('/spotify/connect', authenticateToken, (req: Request, res: Response) => {
  const state = Buffer.from(JSON.stringify({
    userId: req.user!.id,
    timestamp: Date.now(),
  })).toString('base64');

  const params = new URLSearchParams({
    client_id: config.spotify.clientId,
    redirect_uri: config.spotify.callbackUrl,
    response_type: 'code',
    scope: 'user-read-recently-played user-read-playback-position user-library-read',
    state,
  });

  const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;
  res.json({ authUrl });
});

// GET /api/oauth/spotify/callback - Handle Spotify OAuth callback
oauthRouter.get('/spotify/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`${config.frontendUrl}/settings?error=spotify_denied`);
    }

    if (!code || !state) {
      throw new AppError(400, 'Missing code or state');
    }

    // Decode state to get userId
    const stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
    const userId = stateData.userId;

    // Exchange code for tokens
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${config.spotify.clientId}:${config.spotify.clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        code: code as string,
        grant_type: 'authorization_code',
        redirect_uri: config.spotify.callbackUrl,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Spotify token error:', errorData);
      throw new AppError(500, 'Failed to exchange code for tokens');
    }

    const tokens = await tokenResponse.json() as OAuthTokenResponse;

    // Calculate expiry time
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Store or update connected platform
    await prisma.connectedPlatform.upsert({
      where: {
        userId_platform: {
          userId,
          platform: Platform.SPOTIFY,
        },
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || undefined,
        expiresAt,
        lastSyncError: null,
      },
      create: {
        userId,
        platform: Platform.SPOTIFY,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
        expiresAt,
      },
    });

    // Redirect back to frontend
    res.redirect(`${config.frontendUrl}/settings?spotify=connected`);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/oauth/spotify/disconnect
oauthRouter.delete('/spotify/disconnect', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.connectedPlatform.delete({
      where: {
        userId_platform: {
          userId: req.user!.id,
          platform: Platform.SPOTIFY,
        },
      },
    });

    res.json({ message: 'Spotify disconnected successfully' });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// Connection Status
// ============================================================================

// GET /api/oauth/status - Get connection status for all platforms
oauthRouter.get('/status', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const connections = await prisma.connectedPlatform.findMany({
      where: { userId: req.user!.id },
      select: {
        platform: true,
        lastSyncAt: true,
        lastSyncError: true,
        createdAt: true,
      },
    });

    const status = {
      youtube: connections.find((c) => c.platform === Platform.YOUTUBE) || null,
      spotify: connections.find((c) => c.platform === Platform.SPOTIFY) || null,
    };

    res.json(status);
  } catch (error) {
    next(error);
  }
});
