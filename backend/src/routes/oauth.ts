import { Router, Request, Response, NextFunction } from 'express';
import { config } from '../config/env.js';
import { prisma } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { Platform, ContentSourceType } from '@prisma/client';
import { startTikTokAuth, cancelTikTokAuth } from '../services/tiktokAuth.js';
import { startInstagramAuth, cancelInstagramAuth } from '../services/instagramAuth.js';
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
  // Check if request is from iOS app and get app's redirect URI
  const client = req.query.client as string | undefined;
  const appRedirectUri = req.query.appRedirectUri as string | undefined;

  const state = Buffer.from(JSON.stringify({
    userId: req.user!.id,
    timestamp: Date.now(),
    client: client || 'web', // 'ios' or 'web'
    // Store the app's redirect URI to use after OAuth completes
    // This supports both Expo Go (exp://...) and standalone builds (remember://...)
    appRedirectUri: appRedirectUri || null,
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

    // Decode state to get userId, client, and appRedirectUri
    let stateData: { userId: string; client?: string; timestamp: number; appRedirectUri?: string | null };
    try {
      stateData = JSON.parse(Buffer.from((state as string) || '', 'base64').toString());
    } catch {
      throw new AppError(400, 'Invalid state parameter');
    }

    const userId = stateData.userId;
    const isIOS = stateData.client === 'ios';
    const appRedirectUri = stateData.appRedirectUri;

    // Helper to redirect based on client
    // For iOS: use the app's redirect URI (supports both Expo Go and standalone)
    // For web: redirect to frontend settings page
    const redirectToClient = (params: Record<string, string>) => {
      const queryString = new URLSearchParams(params).toString();
      if (isIOS && appRedirectUri) {
        // Use the app-provided redirect URI (works with exp:// in dev and remember:// in prod)
        const separator = appRedirectUri.includes('?') ? '&' : '?';
        console.log(`[OAuth] Redirecting to iOS app: ${appRedirectUri}${separator}${queryString}`);
        return res.redirect(`${appRedirectUri}${separator}${queryString}`);
      } else if (isIOS) {
        // Fallback for iOS without appRedirectUri (legacy)
        return res.redirect(`remember://oauth/youtube/callback?${queryString}`);
      }
      return res.redirect(`${config.frontendUrl}/settings?${queryString}`);
    };

    if (error) {
      // User denied access or other error
      return redirectToClient({ error: 'youtube_denied' });
    }

    if (!code || !state) {
      throw new AppError(400, 'Missing code or state');
    }

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

    // Redirect back to client (iOS app or web frontend)
    return redirectToClient({ youtube: 'connected' });
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
  // Check if request is from iOS app and get app's redirect URI
  const client = req.query.client as string | undefined;
  const appRedirectUri = req.query.appRedirectUri as string | undefined;

  const state = Buffer.from(JSON.stringify({
    userId: req.user!.id,
    timestamp: Date.now(),
    client: client || 'web', // 'ios' or 'web'
    // Store the app's redirect URI to use after OAuth completes
    appRedirectUri: appRedirectUri || null,
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

    // Decode state to get userId, client, and appRedirectUri
    let stateData: { userId: string; client?: string; timestamp: number; appRedirectUri?: string | null };
    try {
      stateData = JSON.parse(Buffer.from((state as string) || '', 'base64').toString());
    } catch {
      throw new AppError(400, 'Invalid state parameter');
    }

    const userId = stateData.userId;
    const isIOS = stateData.client === 'ios';
    const appRedirectUri = stateData.appRedirectUri;

    // Helper to redirect based on client
    // For iOS: use the app's redirect URI (supports both Expo Go and standalone)
    const redirectToClient = (params: Record<string, string>) => {
      const queryString = new URLSearchParams(params).toString();
      if (isIOS && appRedirectUri) {
        const separator = appRedirectUri.includes('?') ? '&' : '?';
        console.log(`[OAuth] Redirecting to iOS app: ${appRedirectUri}${separator}${queryString}`);
        return res.redirect(`${appRedirectUri}${separator}${queryString}`);
      } else if (isIOS) {
        // Fallback for iOS without appRedirectUri (legacy)
        return res.redirect(`remember://oauth/spotify/callback?${queryString}`);
      }
      return res.redirect(`${config.frontendUrl}/settings?${queryString}`);
    };

    if (error) {
      return redirectToClient({ error: 'spotify_denied' });
    }

    if (!code || !state) {
      throw new AppError(400, 'Missing code or state');
    }

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

    // Redirect back to client (iOS app or web frontend)
    return redirectToClient({ spotify: 'connected' });
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
// Instagram (Cookie-based authentication via browser automation)
// ============================================================================

interface InstagramCookiesPayload {
  sessionid: string;
  csrftoken?: string;
  ds_user_id?: string;
  mid?: string;
  ig_did?: string;
  ig_nrcb?: string;
  rur?: string;
  datr?: string;
}

// Allowed Instagram cookie names (whitelist for F5 fix)
const ALLOWED_INSTAGRAM_COOKIES = ['sessionid', 'csrftoken', 'ds_user_id', 'mid', 'ig_did', 'ig_nrcb', 'rur', 'datr'];

// Validate Instagram cookies payload (F5 fix)
function validateInstagramCookies(body: unknown): { valid: boolean; cookies?: InstagramCookiesPayload; error?: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  const raw = body as Record<string, unknown>;

  // Check sessionid exists and is valid format
  if (!raw.sessionid || typeof raw.sessionid !== 'string') {
    return { valid: false, error: 'Missing or invalid sessionid' };
  }

  // sessionid should be alphanumeric with possible special chars, reasonable length (10-200 chars)
  if (raw.sessionid.length < 10 || raw.sessionid.length > 200) {
    return { valid: false, error: 'sessionid has invalid length' };
  }

  // Build sanitized cookies object with only allowed keys
  const cookies: InstagramCookiesPayload = { sessionid: raw.sessionid };

  for (const key of ALLOWED_INSTAGRAM_COOKIES) {
    if (key !== 'sessionid' && raw[key] !== undefined) {
      if (typeof raw[key] !== 'string') {
        return { valid: false, error: `Invalid type for ${key}` };
      }
      // Limit individual cookie value length
      if ((raw[key] as string).length > 500) {
        return { valid: false, error: `${key} value too long` };
      }
      (cookies as Record<string, string>)[key] = raw[key] as string;
    }
  }

  return { valid: true, cookies };
}

// POST /api/oauth/instagram/connect - Start browser-based Instagram auth
oauthRouter.post('/instagram/connect', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if cookies were provided directly (manual mode)
    const validation = validateInstagramCookies(req.body);

    if (validation.valid && validation.cookies) {
      // Manual mode: validated cookies provided
      const cookiesJson = JSON.stringify(validation.cookies);

      await prisma.connectedPlatform.upsert({
        where: {
          userId_platform: {
            userId: req.user!.id,
            platform: Platform.INSTAGRAM,
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
          platform: Platform.INSTAGRAM,
          accessToken: cookiesJson,
          refreshToken: null,
          expiresAt: null,
        },
      });

      return res.json({ message: 'Instagram connected successfully' });
    }

    // If manual cookies were provided but invalid, return error
    if (req.body && req.body.sessionid && !validation.valid) {
      throw new AppError(400, validation.error || 'Invalid cookies format');
    }

    // Auto mode: launch browser for user to login
    console.log(`[Instagram] Starting browser auth for user ${req.user!.id}`);

    const result = await startInstagramAuth(req.user!.id);

    if (!result.success || !result.cookies) {
      throw new AppError(400, result.error || 'Authentication failed');
    }

    // Store cookies
    const cookiesJson = JSON.stringify(result.cookies);

    await prisma.connectedPlatform.upsert({
      where: {
        userId_platform: {
          userId: req.user!.id,
          platform: Platform.INSTAGRAM,
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
        platform: Platform.INSTAGRAM,
        accessToken: cookiesJson,
        refreshToken: null,
        expiresAt: null,
      },
    });

    res.json({ message: 'Instagram connected successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/oauth/instagram/cancel - Cancel pending auth
oauthRouter.post('/instagram/cancel', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await cancelInstagramAuth(req.user!.id);
    res.json({ message: 'Auth cancelled' });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/oauth/instagram/disconnect
oauthRouter.delete('/instagram/disconnect', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.connectedPlatform.delete({
      where: {
        userId_platform: {
          userId: req.user!.id,
          platform: Platform.INSTAGRAM,
        },
      },
    });

    res.json({ message: 'Instagram disconnected successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/oauth/instagram/sync - Trigger manual Instagram sync
oauthRouter.post('/instagram/sync', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Import sync function dynamically
    const { syncInstagramForUser } = await import('../workers/instagramSync.js');

    const newReelsCount = await syncInstagramForUser(req.user!.id);

    res.json({
      message: 'Instagram sync completed',
      newReels: newReelsCount
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
        sourceType: true,
        lastSyncAt: true,
        lastSyncError: true,
        createdAt: true,
      },
    });

    const status = {
      youtube: connections.find((c) => c.platform === Platform.YOUTUBE) || null,
      spotify: connections.find((c) => c.platform === Platform.SPOTIFY) || null,
      tiktok: connections.find((c) => c.platform === Platform.TIKTOK) || null,
      instagram: connections.find((c) => c.platform === Platform.INSTAGRAM) || null,
    };

    res.json(status);
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// Source Type Configuration
// ============================================================================

// PUT /api/oauth/:platform/source - Update content source type for a platform
oauthRouter.put('/:platform/source', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const platform = req.params.platform as string;
    const { sourceType } = req.body as { sourceType?: string };

    // Validate platform
    const platformUpper = platform.toUpperCase() as Platform;
    if (!Object.values(Platform).includes(platformUpper)) {
      throw new AppError(400, `Invalid platform: ${platform}`);
    }

    // Validate sourceType matches platform
    const validSourceTypes: Record<Platform, string[]> = {
      YOUTUBE: ['YOUTUBE_LIKES', 'YOUTUBE_WATCH_LATER'],
      SPOTIFY: ['SPOTIFY_SAVED', 'SPOTIFY_RECENT'],
      TIKTOK: ['TIKTOK_LIKES'],
      INSTAGRAM: ['INSTAGRAM_SAVED', 'INSTAGRAM_LIKED', 'INSTAGRAM_BOTH'],
    };

    if (sourceType && !validSourceTypes[platformUpper].includes(sourceType)) {
      throw new AppError(400, `Invalid sourceType "${sourceType}" for platform ${platform}. Valid options: ${validSourceTypes[platformUpper].join(', ')}`);
    }

    // Update the connection
    const connection = await prisma.connectedPlatform.update({
      where: {
        userId_platform: {
          userId: req.user!.id,
          platform: platformUpper,
        },
      },
      data: {
        sourceType: sourceType ? (sourceType as ContentSourceType) : null,
      },
      select: {
        platform: true,
        sourceType: true,
        lastSyncAt: true,
        createdAt: true,
      },
    });

    res.json({
      message: `Source type updated for ${platform}`,
      connection,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return next(new AppError(404, `Platform ${req.params.platform} is not connected`));
    }
    next(error);
  }
});

// ============================================================================
// Desktop Auth Flow (for iOS app - opens in desktop browser via tunnel)
// ============================================================================

// Store for pending desktop auth sessions
const pendingDesktopAuth = new Map<string, {
  platform: 'tiktok' | 'instagram';
  userId: string;
  createdAt: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error?: string;
}>();

// Clean up old sessions (older than 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of pendingDesktopAuth) {
    if (now - session.createdAt > 10 * 60 * 1000) {
      pendingDesktopAuth.delete(token);
    }
  }
}, 60 * 1000);

// POST /api/oauth/desktop/start - iOS calls this to get a desktop auth URL
oauthRouter.post('/desktop/start', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { platform } = req.body as { platform?: string };

    if (!platform || !['tiktok', 'instagram'].includes(platform)) {
      throw new AppError(400, 'Invalid platform. Must be tiktok or instagram.');
    }

    // Generate unique token
    const token = Buffer.from(`${req.user!.id}-${Date.now()}-${Math.random()}`).toString('base64url');

    // Store session
    pendingDesktopAuth.set(token, {
      platform: platform as 'tiktok' | 'instagram',
      userId: req.user!.id,
      createdAt: Date.now(),
      status: 'pending',
    });

    // Return the desktop auth URL (accessible via tunnel)
    const baseUrl = config.youtube.callbackUrl.replace('/api/oauth/youtube/callback', '');
    const desktopUrl = `${baseUrl}/api/oauth/desktop/page/${token}`;

    res.json({
      token,
      url: desktopUrl,
      expiresIn: 600, // 10 minutes
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/oauth/desktop/status/:token - iOS polls this to check auth status
oauthRouter.get('/desktop/status/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    const session = pendingDesktopAuth.get(token);

    if (!session) {
      return res.json({ status: 'expired' });
    }

    res.json({
      status: session.status,
      platform: session.platform,
      error: session.error,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/oauth/desktop/page/:token - Desktop browser opens this page
oauthRouter.get('/desktop/page/:token', async (req: Request, res: Response) => {
  const { token } = req.params;
  const session = pendingDesktopAuth.get(token);

  if (!session) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Session Expired - Remember</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
          .card { background: white; padding: 48px; border-radius: 16px; text-align: center; max-width: 400px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
          h1 { color: #DC2626; margin-bottom: 16px; }
          p { color: #666; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>⏰ Session Expired</h1>
          <p>This link has expired. Please go back to the Remember app and try again.</p>
        </div>
      </body>
      </html>
    `);
  }

  const platformName = session.platform === 'tiktok' ? 'TikTok' : 'Instagram';
  const platformColor = session.platform === 'tiktok' ? '#000000' : '#E4405F';

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Connect ${platformName} - Remember</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
        .card { background: white; padding: 48px; border-radius: 16px; text-align: center; max-width: 450px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .icon { width: 80px; height: 80px; background: ${platformColor}; border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; }
        .icon svg { width: 48px; height: 48px; fill: white; }
        h1 { margin: 0 0 12px; color: #111; font-size: 24px; }
        p { color: #666; margin: 0 0 32px; line-height: 1.6; }
        .btn { background: ${platformColor}; color: white; border: none; padding: 16px 32px; font-size: 16px; font-weight: 600; border-radius: 12px; cursor: pointer; width: 100%; transition: opacity 0.2s; }
        .btn:hover { opacity: 0.9; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .status { margin-top: 24px; padding: 16px; background: #f9fafb; border-radius: 8px; }
        .status.success { background: #dcfce7; color: #166534; }
        .status.error { background: #fee2e2; color: #991b1b; }
        .status.loading { background: #e0f2fe; color: #075985; }
        .spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid currentColor; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; margin-right: 8px; vertical-align: middle; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .note { font-size: 13px; color: #999; margin-top: 24px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">
          ${session.platform === 'tiktok'
            ? '<svg viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/></svg>'
            : '<svg viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>'
          }
        </div>
        <h1>Connect ${platformName}</h1>
        <p>Click the button below to open ${platformName} and log in. A browser window will open - complete the login there.</p>

        <button id="connectBtn" class="btn">
          Connect ${platformName}
        </button>

        <div id="status" class="status" style="display: none;"></div>

        <p class="note">This page will automatically update when connected.<br>You can close this tab after seeing the success message.</p>
      </div>

      <script>
        (function() {
          const token = "${token}";
          const platform = "${session.platform}";
          const btn = document.getElementById('connectBtn');
          const status = document.getElementById('status');

          console.log('[DesktopAuth] Page loaded, token:', token.substring(0, 20) + '...');

          btn.addEventListener('click', async function() {
            console.log('[DesktopAuth] Button clicked!');

            btn.disabled = true;
            btn.textContent = 'Opening ${platformName}...';
            status.style.display = 'block';
            status.className = 'status loading';
            status.innerHTML = '<span class="spinner"></span> Starting... A browser window will open on this computer.';

            try {
              const url = window.location.origin + '/api/oauth/desktop/execute/' + token;
              console.log('[DesktopAuth] Fetching:', url);

              const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
              });

              console.log('[DesktopAuth] Response status:', res.status);
              const text = await res.text();
              console.log('[DesktopAuth] Response text:', text);

              let data;
              try {
                data = JSON.parse(text);
              } catch (e) {
                throw new Error('Invalid JSON response: ' + text.substring(0, 200));
              }

              if (data.success) {
                status.className = 'status success';
                status.innerHTML = '✓ Connected! You can now close this tab and return to the app.';
                btn.textContent = 'Connected!';
              } else {
                status.className = 'status error';
                status.innerHTML = '✗ ' + (data.error || 'Connection failed. Please try again.');
                btn.disabled = false;
                btn.textContent = 'Try Again';
              }
            } catch (err) {
              console.error('[DesktopAuth] Error:', err);
              status.className = 'status error';
              status.innerHTML = '✗ Error: ' + (err.message || 'Network error. Check console (F12) for details.');
              btn.disabled = false;
              btn.textContent = 'Try Again';
            }
          });
        })();
      </script>
    </body>
    </html>
  `);
});

// POST /api/oauth/desktop/execute/:token - Actually run Playwright auth
oauthRouter.post('/desktop/execute/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    console.log(`[Desktop Auth] Execute request for token: ${token.substring(0, 20)}...`);

    const session = pendingDesktopAuth.get(token);

    if (!session) {
      console.log('[Desktop Auth] Session not found');
      return res.json({ success: false, error: 'Session expired' });
    }

    console.log(`[Desktop Auth] Session found: platform=${session.platform}, status=${session.status}`);

    if (session.status !== 'pending') {
      console.log('[Desktop Auth] Session already used');
      return res.json({ success: false, error: 'Session already used' });
    }

    // Mark as in progress
    session.status = 'in_progress';
    console.log(`[Desktop Auth] Starting ${session.platform} auth for user ${session.userId}`);

    let result;
    if (session.platform === 'tiktok') {
      result = await startTikTokAuth(session.userId);
    } else {
      result = await startInstagramAuth(session.userId);
    }

    if (result.success && result.cookies) {
      // Store cookies in database
      const cookiesJson = JSON.stringify(result.cookies);
      const platformEnum = session.platform === 'tiktok' ? Platform.TIKTOK : Platform.INSTAGRAM;

      await prisma.connectedPlatform.upsert({
        where: {
          userId_platform: {
            userId: session.userId,
            platform: platformEnum,
          },
        },
        update: {
          accessToken: cookiesJson,
          refreshToken: null,
          expiresAt: null,
          lastSyncError: null,
        },
        create: {
          userId: session.userId,
          platform: platformEnum,
          accessToken: cookiesJson,
          refreshToken: null,
          expiresAt: null,
        },
      });

      session.status = 'completed';
      pendingDesktopAuth.delete(token);

      res.json({ success: true });
    } else {
      session.status = 'failed';
      session.error = result.error || 'Authentication failed';

      res.json({ success: false, error: session.error });
    }
  } catch (error) {
    const session = pendingDesktopAuth.get(req.params.token);
    if (session) {
      session.status = 'failed';
      session.error = error instanceof Error ? error.message : 'Unknown error';
    }
    next(error);
  }
});
