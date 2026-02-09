// YouTube Sync Worker - Fetches liked videos from YouTube Data API
// Runs every 15 minutes via cron job
import { logger } from '../config/logger.js';
import { prisma } from '../config/database.js';
import { Platform, ContentStatus } from '@prisma/client';
import { getValidToken } from '../services/tokenRefresh.js';
import { youtubeLimiter } from '../utils/rateLimiter.js';

const log = logger.child({ job: 'youtube-sync' });

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

interface YouTubePlaylistResponse {
  items: Array<{
    snippet: {
      publishedAt: string;
      title: string;
      description: string;
      thumbnails: {
        high?: { url: string };
        medium?: { url: string };
        default?: { url: string };
      };
      resourceId: {
        videoId: string;
      };
      videoOwnerChannelTitle?: string;  // Channel name of the video owner
      videoOwnerChannelId?: string;
    };
    contentDetails?: {
      videoId: string;
    };
  }>;
  nextPageToken?: string;
}

/**
 * Fetch liked videos from YouTube for a specific user
 * Exported for use in OAuth callbacks and manual refresh
 */
export async function syncUserYouTube(userId: string, connectionId: string): Promise<number> {
  const connection = await prisma.connectedPlatform.findUnique({
    where: { id: connectionId },
  });

  if (!connection) {
    log.error({ connectionId }, 'Connection not found');
    return 0;
  }

  let accessToken: string;
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

  // First, get the "Liked videos" playlist ID
  // It's "LL" + channel ID, but we can use the special "LL" shorthand
  const likedPlaylistId = 'LL'; // YouTube's special ID for liked videos playlist

  let newVideosCount = 0;
  let nextPageToken: string | undefined;
  const maxPages = 1; // Limit to 1 page (15 videos max) per sync
  let currentPage = 0;

  try {
    do {
      const url = new URL(`${YOUTUBE_API_BASE}/playlistItems`);
      url.searchParams.set('part', 'snippet,contentDetails');
      url.searchParams.set('playlistId', likedPlaylistId);
      url.searchParams.set('maxResults', '15');
      if (nextPageToken) {
        url.searchParams.set('pageToken', nextPageToken);
      }

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`YouTube API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as YouTubePlaylistResponse;

      // Process each video
      for (const item of data.items) {
        const videoId = item.snippet.resourceId?.videoId || item.contentDetails?.videoId;
        if (!videoId) continue;

        // Get thumbnail URL (prefer high quality)
        const thumbnailUrl =
          item.snippet.thumbnails.high?.url ||
          item.snippet.thumbnails.medium?.url ||
          item.snippet.thumbnails.default?.url ||
          null;

        // Get channel name from video owner
        const channelName = item.snippet.videoOwnerChannelTitle || null;

        // Upsert content entry (avoid race condition with unique constraint)
        const result = await prisma.content.upsert({
          where: {
            userId_platform_externalId: {
              userId,
              platform: Platform.YOUTUBE,
              externalId: videoId,
            },
          },
          update: {
            // Update metadata if video already exists
            title: item.snippet.title,
            description: item.snippet.description?.substring(0, 1000) || null,
            thumbnailUrl,
            channelName,
          },
          create: {
            userId,
            platform: Platform.YOUTUBE,
            externalId: videoId,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            title: item.snippet.title,
            description: item.snippet.description?.substring(0, 1000) || null,
            thumbnailUrl,
            channelName,
            capturedAt: new Date(item.snippet.publishedAt),
            status: ContentStatus.INBOX,
          },
        });

        // Check if this was a new creation (no updatedAt before)
        if (result.createdAt.getTime() === result.updatedAt.getTime()) {
          newVideosCount++;
        }
      }

      nextPageToken = data.nextPageToken;
      currentPage++;

      // Small delay to avoid rate limiting
      if (nextPageToken && currentPage < maxPages) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } while (nextPageToken && currentPage < maxPages);

    // Update last sync time
    await prisma.connectedPlatform.update({
      where: { id: connectionId },
      data: {
        lastSyncAt: new Date(),
        lastSyncError: null,
      },
    });

    log.info({ userId, videoCount: newVideosCount }, 'New content synced');
    return newVideosCount;

  } catch (error) {
    log.error({ err: error, userId }, 'Sync failed for user');
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
 * Main sync function - syncs all connected YouTube accounts
 */
export async function runYouTubeSync(): Promise<void> {
  log.info('Starting sync');
  const startTime = Date.now();

  // Get all active YouTube connections
  const connections = await prisma.connectedPlatform.findMany({
    where: { platform: Platform.YOUTUBE },
    include: { user: true },
  });

  log.info({ userCount: connections.length }, 'Found users to sync');

  let totalNewVideos = 0;
  let successCount = 0;
  let errorCount = 0;

  const results = await Promise.allSettled(
    connections.map(connection =>
      youtubeLimiter(() => syncUserYouTube(connection.userId, connection.id))
    )
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      totalNewVideos += result.value;
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
    totalNewVideos
  }, 'Sync completed');
}
