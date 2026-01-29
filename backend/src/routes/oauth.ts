import { Router, Request, Response, NextFunction } from 'express';
import { config } from '../config/env.js';
import { prisma } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { Platform } from '@prisma/client';
import { startTikTokAuth, cancelTikTokAuth } from '../services/tiktokAuth.js';
import { syncUserYouTube } from '../workers/youtubeSync.js';
import { syncUserSpotify } from '../workers/spotifySync.js';

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
    const connection = await prisma.connectedPlatform.upsert({
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

    // Trigger immediate sync in background (non-blocking)
    syncUserYouTube(userId, connection.id).catch((error) => {
      console.error(`[OAuth] Background YouTube sync failed for user ${userId}:`, error);
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
    const connection = await prisma.connectedPlatform.upsert({
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

    // Trigger immediate sync in background (non-blocking)
    syncUserSpotify(userId, connection.id).catch((error) => {
      console.error(`[OAuth] Background Spotify sync failed for user ${userId}:`, error);
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
// TikTok (Cookie-based authentication via browser automation)
// ============================================================================

interface TikTokCookiesPayload {
  sessionid: string;
  sessionid_ss?: string;
  sid_tt?: string;
  uid_tt?: string;
  msToken?: string;
  tt_chain_token?: string;
  tt_csrf_token?: string;
  passport_csrf_token?: string;
  s_v_web_id?: string;
  odin_tt?: string;
  sid_guard?: string;
}

// POST /api/oauth/tiktok/connect - Start browser-based TikTok auth
oauthRouter.post('/tiktok/connect', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if cookies were provided directly (manual mode)
    const cookies = req.body as TikTokCookiesPayload;

    if (cookies && cookies.sessionid) {
      // Manual mode: cookies provided directly
      const cookiesJson = JSON.stringify(cookies);

      await prisma.connectedPlatform.upsert({
        where: {
          userId_platform: {
            userId: req.user!.id,
            platform: Platform.TIKTOK,
          },
        },
        update: {
          accessToken: cookiesJson,
          refreshToken: null,
          expiresAt: null,
          lastSyncError: null,
        },
        create: {
          userId: req.user!.id,
          platform: Platform.TIKTOK,
          accessToken: cookiesJson,
          refreshToken: null,
          expiresAt: null,
        },
      });

      return res.json({ message: 'TikTok connected successfully' });
    }

    // Auto mode: launch browser for user to login
    console.log(`[TikTok] Starting browser auth for user ${req.user!.id}`);

    const result = await startTikTokAuth(req.user!.id);

    if (!result.success || !result.cookies) {
      throw new AppError(400, result.error || 'Authentication failed');
    }

    // Store cookies
    const cookiesJson = JSON.stringify(result.cookies);

    await prisma.connectedPlatform.upsert({
      where: {
        userId_platform: {
          userId: req.user!.id,
          platform: Platform.TIKTOK,
        },
      },
      update: {
        accessToken: cookiesJson,
        refreshToken: null,
        expiresAt: null,
        lastSyncError: null,
      },
      create: {
        userId: req.user!.id,
        platform: Platform.TIKTOK,
        accessToken: cookiesJson,
        refreshToken: null,
        expiresAt: null,
      },
    });

    res.json({ message: 'TikTok connected successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/oauth/tiktok/cancel - Cancel pending auth
oauthRouter.post('/tiktok/cancel', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await cancelTikTokAuth(req.user!.id);
    res.json({ message: 'Auth cancelled' });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/oauth/tiktok/disconnect
oauthRouter.delete('/tiktok/disconnect', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.connectedPlatform.delete({
      where: {
        userId_platform: {
          userId: req.user!.id,
          platform: Platform.TIKTOK,
        },
      },
    });

    res.json({ message: 'TikTok disconnected successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/oauth/tiktok/sync - Trigger manual TikTok sync
oauthRouter.post('/tiktok/sync', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Import sync function dynamically
    const { syncTikTokForUser } = await import('../workers/tiktokSync.js');

    const newVideosCount = await syncTikTokForUser(req.user!.id);

    res.json({
      message: 'TikTok sync completed',
      newVideos: newVideosCount
    });
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
      tiktok: connections.find((c) => c.platform === Platform.TIKTOK) || null,
    };

    res.json(status);
  } catch (error) {
    next(error);
  }
});
