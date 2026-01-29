// Spotify Sync Worker - Fetches LISTENED podcast episodes
// Only syncs episodes that are fully played or >80% listened
import { prisma } from '../config/database.js';
import { Platform, ContentStatus } from '@prisma/client';
import { getValidToken } from '../services/tokenRefresh.js';

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const MIN_PROGRESS_PERCENT = 80; // Only sync episodes listened >80%

interface SpotifyEpisode {
  id: string;
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

interface SpotifySavedEpisodesResponse {
  items: Array<{
    added_at: string;
    episode: SpotifyEpisode;
  }>;
  next: string | null;
  total: number;
}

/**
 * Sync user's LISTENED Spotify episodes
 * Only fetches saved episodes that have been fully played or >80% listened
 * Exported for use in OAuth callbacks and manual refresh
 */
export async function syncUserSpotify(userId: string, connectionId: string): Promise<number> {
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
    console.error(`[Spotify Sync] Failed to get valid token for user ${userId}:`, error);
    await prisma.connectedPlatform.update({
      where: { id: connectionId },
      data: { lastSyncError: 'Failed to refresh token' },
    });
    return 0;
  }

  let newEpisodesCount = 0;
  let updatedEpisodesCount = 0;

  try {
    // Fetch ALL saved episodes (paginated)
    let nextUrl: string | null = `${SPOTIFY_API_BASE}/me/episodes?limit=50`;

    while (nextUrl) {
      const response = await fetch(nextUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw new Error(`Spotify API error: ${response.status}`);
      }

      const data = await response.json() as SpotifySavedEpisodesResponse;

      for (const item of data.items) {
        const episode = item.episode;
        if (!episode) continue;

        // Calculate progress
        const resumePoint = episode.resume_point;
        let listenProgress = 0;
        let fullyPlayed = false;

        if (resumePoint) {
          fullyPlayed = resumePoint.fully_played;
          if (episode.duration_ms > 0) {
            listenProgress = Math.round((resumePoint.resume_position_ms / episode.duration_ms) * 100);
          }
          if (fullyPlayed) {
            listenProgress = 100;
          }
        }

        // Only sync if listened enough
        if (!fullyPlayed && listenProgress < MIN_PROGRESS_PERCENT) {
          continue;
        }

        // Check if we already have this episode
        const existing = await prisma.content.findUnique({
          where: {
            userId_platform_externalId: {
              userId,
              platform: Platform.SPOTIFY,
              externalId: episode.id,
            },
          },
        });

        // Sanitize description to avoid DB errors with special chars
        const sanitizedDescription = episode.description
          ?.replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
          ?.substring(0, 1000) || null;

        const thumbnailUrl = episode.images?.[0]?.url || episode.show?.images?.[0]?.url || null;

        if (existing) {
          // Update progress if changed
          if (existing.listenProgress !== listenProgress || existing.fullyPlayed !== fullyPlayed) {
            await prisma.content.update({
              where: { id: existing.id },
              data: { listenProgress, fullyPlayed },
            });
            updatedEpisodesCount++;
          }
        } else {
          // Create new content entry
          await prisma.content.create({
            data: {
              userId,
              platform: Platform.SPOTIFY,
              externalId: episode.id,
              url: episode.external_urls?.spotify || `https://open.spotify.com/episode/${episode.id}`,
              title: episode.name,
              description: sanitizedDescription,
              thumbnailUrl,
              duration: Math.floor(episode.duration_ms / 1000),
              showName: episode.show?.name,
              listenProgress,
              fullyPlayed,
              capturedAt: new Date(item.added_at),
              status: ContentStatus.INBOX,
            },
          });
          newEpisodesCount++;
        }
      }

      // Get next page
      nextUrl = data.next;

      // Small delay to avoid rate limiting
      if (nextUrl) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Update last sync time
    await prisma.connectedPlatform.update({
      where: { id: connectionId },
      data: {
        lastSyncAt: new Date(),
        lastSyncError: null,
      },
    });

    console.log(`[Spotify Sync] User ${userId}: ${newEpisodesCount} new, ${updatedEpisodesCount} updated`);
    return newEpisodesCount;

  } catch (error) {
    console.error(`[Spotify Sync] Error for user ${userId}:`, error);
    await prisma.connectedPlatform.update({
      where: { id: connectionId },
      data: {
        lastSyncError: error instanceof Error ? error.message : 'Unknown error',
      },
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

  // Get all active Spotify connections
  const connections = await prisma.connectedPlatform.findMany({
    where: { platform: Platform.SPOTIFY },
    include: { user: true },
  });

  console.log(`[Spotify Sync] Found ${connections.length} Spotify connections`);

  let totalNewEpisodes = 0;
  let successCount = 0;
  let errorCount = 0;

  for (const connection of connections) {
    try {
      const newEpisodes = await syncUserSpotify(connection.userId, connection.id);
      totalNewEpisodes += newEpisodes;
      successCount++;
    } catch (error) {
      console.error(`[Spotify Sync] Failed for user ${connection.userId}:`, error);
      errorCount++;
    }

    // Small delay between users
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const duration = Date.now() - startTime;
  console.log(`[Spotify Sync] Completed in ${duration}ms`);
  console.log(`[Spotify Sync] Results: ${successCount} success, ${errorCount} errors, ${totalNewEpisodes} new episodes`);
}
