// Spotify Sync Worker - Fetches listened podcast episodes
// Sources: recently-played (any episode listened) + saved episodes (bookmarked)
// Supports two auth modes:
//   1. OAuth (refreshToken present) — standard Spotify API with token refresh
//   2. Cookie (sp_dc cookie, no refreshToken) — web player token endpoint, same API
import { logger } from '../config/logger.js';
import { prisma } from '../config/database.js';
import { Platform, ContentStatus } from '@prisma/client';
import { getValidToken } from '../services/tokenRefresh.js';
import { spotifyLimiter } from '../utils/rateLimiter.js';

const log = logger.child({ job: 'spotify-sync' });

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

// --- Cookie-based auth ---

interface SpotifyCookies {
  sp_dc: string;
}

interface SpotifyWebToken {
  clientId: string;
  accessToken: string;
  accessTokenExpirationTimestampMs: number;
  isAnonymous: boolean;
}

/**
 * Get bearer token from sp_dc cookie (cookie-based auth).
 * Uses Spotify's web player token endpoint — returns a standard bearer token
 * that works with api.spotify.com/v1/ endpoints.
 */
async function getTokenFromCookie(spDc: string): Promise<string> {
  const response = await fetch(
    'https://open.spotify.com/get_access_token?reason=transport&productType=web_player',
    {
      headers: {
        'Cookie': `sp_dc=${spDc}`,
      },
    }
  );

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Session expired. Please reconnect.');
    }
    throw new Error(`Token fetch failed: ${response.status}`);
  }

  const data = await response.json() as SpotifyWebToken;

  if (!data.accessToken || data.isAnonymous) {
    throw new Error('Session expired. Please reconnect.');
  }

  return data.accessToken;
}

interface SpotifyEpisode {
  id: string;
  type?: string;
  name: string;
  description: string;
  images: Array<{ url: string; width: number; height: number }>;
  duration_ms: number;
  release_date: string;
  external_urls: {
    spotify: string;
  };
  show: {
    id: string;
    name: string;
    publisher: string;
    images: Array<{ url: string }>;
  };
  resume_point?: {
    fully_played: boolean;
    resume_position_ms: number;
  };
}

interface SpotifyRecentlyPlayedResponse {
  items: Array<{
    track: SpotifyEpisode & { type: string };
    played_at: string;
  }>;
  next: string | null;
}

interface SpotifySavedEpisodesResponse {
  items: Array<{
    added_at: string;
    episode: SpotifyEpisode;
  }>;
  next: string | null;
  total: number;
}

interface EpisodeData {
  id: string;
  name: string;
  description: string | null;
  thumbnailUrl: string | null;
  showName: string | null;
  url: string;
  duration: number;
  capturedAt: Date;
  listenProgress: number;
  fullyPlayed: boolean;
}

/**
 * Sync user's Spotify episodes from two sources:
 * 1. Recently played - catches any episode listened to (even if not saved)
 * 2. Saved episodes - provides detailed progress info for bookmarked episodes
 */
export async function syncUserSpotify(userId: string, connectionId: string, _userEmail?: string): Promise<number> {
  const connection = await prisma.connectedPlatform.findUnique({
    where: { id: connectionId },
  });

  if (!connection) {
    log.error({ connectionId }, 'Connection not found');
    return 0;
  }

  let accessToken: string;

  // Detect auth mode: cookie-based (no refreshToken, accessToken is JSON with sp_dc) vs OAuth
  const isCookieMode = !connection.refreshToken && connection.accessToken.startsWith('{');

  if (isCookieMode) {
    try {
      const cookies = JSON.parse(connection.accessToken) as SpotifyCookies;
      if (!cookies.sp_dc) {
        throw new Error('Missing sp_dc cookie');
      }
      accessToken = await getTokenFromCookie(cookies.sp_dc);
      log.info({ userId, mode: 'cookie' }, 'Got Spotify token from cookie');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Cookie auth failed';
      log.error({ err: error, userId }, 'Failed to get token from cookie');
      await prisma.connectedPlatform.update({
        where: { id: connectionId },
        data: { lastSyncError: errorMsg },
      });
      return 0;
    }
  } else {
    try {
      accessToken = await getValidToken(connection);
    } catch (error) {
      log.error({ err: error, userId }, 'Failed to get valid token');
      await prisma.connectedPlatform.update({
        where: { id: connectionId },
        data: { lastSyncError: 'Failed to refresh token' },
      });
      return 0;
    }
  }

  const episodes = new Map<string, EpisodeData>();
  let newEpisodesCount = 0;
  let updatedEpisodesCount = 0;

  try {
    // Source 1: Recently played - catches episodes listened but not saved
    try {
      const recentResponse = await fetch(`${SPOTIFY_API_BASE}/me/player/recently-played?limit=50`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (recentResponse.ok) {
        const recentData = await recentResponse.json() as SpotifyRecentlyPlayedResponse;
        for (const item of recentData.items) {
          const track = item.track;
          if (!track || track.type !== 'episode') continue;

          const episode = track as SpotifyEpisode;
          if (!episode.id || !episode.name) continue;

          const sanitizedDescription = episode.description
            ?.replace(/[\x00-\x1F\x7F]/g, '')
            ?.substring(0, 1000) || null;

          let listenProgress = 100;
          let fullyPlayed = true;

          if (episode.resume_point) {
            fullyPlayed = episode.resume_point.fully_played;
            if (episode.duration_ms > 0) {
              listenProgress = Math.round((episode.resume_point.resume_position_ms / episode.duration_ms) * 100);
            }
            if (fullyPlayed) listenProgress = 100;
          }

          episodes.set(episode.id, {
            id: episode.id,
            name: episode.name,
            description: sanitizedDescription,
            thumbnailUrl: episode.images?.[0]?.url || episode.show?.images?.[0]?.url || null,
            showName: episode.show?.name || null,
            url: episode.external_urls?.spotify || `https://open.spotify.com/episode/${episode.id}`,
            duration: Math.floor((episode.duration_ms || 0) / 1000),
            capturedAt: new Date(item.played_at),
            listenProgress,
            fullyPlayed,
          });
        }
        log.info({ userId, episodeCount: episodes.size }, 'Found episodes from recently-played');
      } else {
        log.warn({ userId, status: recentResponse.status }, 'Recently-played returned error, continuing with saved episodes');
      }
    } catch (recentError) {
      log.warn({ userId }, 'Recently-played fetch failed, continuing with saved episodes');
    }

    // Source 2: Saved episodes - detailed progress info for bookmarked episodes
    try {
      const savedResponse = await fetch(`${SPOTIFY_API_BASE}/me/episodes?limit=50`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (savedResponse.ok) {
        const savedData = await savedResponse.json() as SpotifySavedEpisodesResponse;

        for (const item of savedData.items) {
          const episode = item.episode;
          if (!episode) continue;

          const resumePoint = episode.resume_point;
          let listenProgress = 0;
          let fullyPlayed = false;

          if (resumePoint) {
            fullyPlayed = resumePoint.fully_played;
            if (episode.duration_ms > 0) {
              listenProgress = Math.round((resumePoint.resume_position_ms / episode.duration_ms) * 100);
            }
            if (fullyPlayed) listenProgress = 100;
          }

          // Only include saved episodes if listened >80%
          if (!fullyPlayed && listenProgress < 80) continue;

          const sanitizedDescription = episode.description
            ?.replace(/[\x00-\x1F\x7F]/g, '')
            ?.substring(0, 1000) || null;

          // Saved episodes override recently-played data (more accurate progress)
          episodes.set(episode.id, {
            id: episode.id,
            name: episode.name,
            description: sanitizedDescription,
            thumbnailUrl: episode.images?.[0]?.url || episode.show?.images?.[0]?.url || null,
            showName: episode.show?.name || null,
            url: episode.external_urls?.spotify || `https://open.spotify.com/episode/${episode.id}`,
            duration: Math.floor(episode.duration_ms / 1000),
            capturedAt: new Date(item.added_at),
            listenProgress,
            fullyPlayed,
          });
        }
      } else {
        log.warn({ userId, status: savedResponse.status }, 'Saved episodes returned error');
      }
    } catch (savedError) {
      log.warn({ userId }, 'Saved episodes fetch failed');
    }

    // Upsert all collected episodes (deduplicated by ID)
    for (const ep of episodes.values()) {
      const result = await prisma.content.upsert({
        where: {
          userId_platform_externalId: {
            userId,
            platform: Platform.SPOTIFY,
            externalId: ep.id,
          },
        },
        update: {
          listenProgress: ep.listenProgress,
          fullyPlayed: ep.fullyPlayed,
        },
        create: {
          userId,
          platform: Platform.SPOTIFY,
          externalId: ep.id,
          url: ep.url,
          title: ep.name,
          description: ep.description,
          thumbnailUrl: ep.thumbnailUrl,
          duration: ep.duration,
          showName: ep.showName,
          channelName: ep.showName,
          listenProgress: ep.listenProgress,
          fullyPlayed: ep.fullyPlayed,
          capturedAt: ep.capturedAt,
          status: ContentStatus.INBOX,
        },
      });

      if (result.createdAt.getTime() === result.updatedAt.getTime()) {
        newEpisodesCount++;
      } else {
        updatedEpisodesCount++;
      }
    }

    await prisma.connectedPlatform.update({
      where: { id: connectionId },
      data: { lastSyncAt: new Date(), lastSyncError: null },
    });

    log.info({
      userId,
      newCount: newEpisodesCount,
      updatedCount: updatedEpisodesCount,
      totalCount: episodes.size
    }, 'New content synced');
    return newEpisodesCount;

  } catch (error) {
    log.error({ err: error, userId }, 'Sync failed for user');
    await prisma.connectedPlatform.update({
      where: { id: connectionId },
      data: { lastSyncError: error instanceof Error ? error.message : 'Unknown error' },
    });
    return 0;
  }
}

/**
 * Main sync function - syncs all connected Spotify accounts
 */
export async function runSpotifySync(): Promise<void> {
  log.info('Starting sync');
  const startTime = Date.now();

  const connections = await prisma.connectedPlatform.findMany({
    where: { platform: Platform.SPOTIFY },
    include: { user: true },
  });

  log.info({ userCount: connections.length }, 'Found users to sync');

  let totalNewEpisodes = 0;
  let successCount = 0;
  let errorCount = 0;

  const results = await Promise.allSettled(
    connections.map(connection =>
      spotifyLimiter(() => syncUserSpotify(connection.userId, connection.id, connection.user.email))
    )
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      totalNewEpisodes += result.value;
      successCount++;
    } else {
      errorCount++;
    }
  }

  const duration = Date.now() - startTime;
  log.info({
    durationMs: duration,
    successCount,
    errorCount,
    totalNewEpisodes
  }, 'Sync completed');
}
