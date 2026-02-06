// Spotify Sync Worker - Fetches listened podcast episodes
// Sources: recently-played (any episode listened) + saved episodes (bookmarked)
import { prisma } from '../config/database.js';
import { Platform, ContentStatus } from '@prisma/client';
import { getValidToken } from '../services/tokenRefresh.js';
import { spotifyLimiter } from '../utils/rateLimiter.js';

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

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
export async function syncUserSpotify(userId: string, connectionId: string, userEmail?: string): Promise<number> {
  const label = userEmail || userId;
  const connection = await prisma.connectedPlatform.findUnique({
    where: { id: connectionId },
  });

  if (!connection) {
    console.error(`[Spotify Sync] Connection ${connectionId} not found`);
    return 0;
  }

  let accessToken: string;
  try {
    accessToken = await getValidToken(connection);
  } catch (error) {
    console.error(`[Spotify Sync] Failed to get valid token for ${label}:`, error);
    await prisma.connectedPlatform.update({
      where: { id: connectionId },
      data: { lastSyncError: 'Failed to refresh token' },
    });
    return 0;
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
        console.log(`[Spotify Sync] ${label}: found ${episodes.size} episodes from recently-played`);
      } else {
        console.warn(`[Spotify Sync] ${label}: recently-played returned ${recentResponse.status}, continuing with saved episodes`);
      }
    } catch (recentError) {
      console.warn(`[Spotify Sync] ${label}: recently-played fetch failed, continuing with saved episodes`);
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
        console.warn(`[Spotify Sync] ${label}: saved episodes returned ${savedResponse.status}`);
      }
    } catch (savedError) {
      console.warn(`[Spotify Sync] ${label}: saved episodes fetch failed`);
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

    console.log(`[Spotify Sync] ${label}: ${newEpisodesCount} new, ${updatedEpisodesCount} updated (${episodes.size} total)`);
    return newEpisodesCount;

  } catch (error) {
    console.error(`[Spotify Sync] Error for ${label}:`, error);
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
  console.log('[Spotify Sync] Starting sync job...');
  const startTime = Date.now();

  const connections = await prisma.connectedPlatform.findMany({
    where: { platform: Platform.SPOTIFY },
    include: { user: true },
  });

  console.log(`[Spotify Sync] Found ${connections.length} Spotify connections`);

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
  console.log(`[Spotify Sync] Completed in ${duration}ms`);
  console.log(`[Spotify Sync] Results: ${successCount} success, ${errorCount} errors, ${totalNewEpisodes} new episodes`);
}
