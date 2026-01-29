// YouTube Sync Worker - Fetches liked videos from YouTube Data API
// Runs every 15 minutes via cron job
import { prisma } from '../config/database.js';
import { Platform, ContentStatus } from '@prisma/client';
import { getValidToken } from '../services/tokenRefresh.js';

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
    };
    contentDetails?: {
      videoId: string;
    };
  }>;
  nextPageToken?: string;
}

/**
 * Fetch liked videos from YouTube for a specific user
 */
async function syncUserYouTube(userId: string, connectionId: string): Promise<number> {
  const connection = await prisma.connectedPlatform.findUnique({
    where: { id: connectionId },
  });

  if (!connection) {
    console.error(`[YouTube Sync] Connection ${connectionId} not found`);
    return 0;
  }

  let accessToken: string;
  try {
    accessToken = await getValidToken(connection);
  } catch (error) {
    console.error(`[YouTube Sync] Failed to get valid token for user ${userId}:`, error);
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
  const maxPages = 5; // Limit to 5 pages (250 videos max) per sync
  let currentPage = 0;

  try {
    do {
      const url = new URL(`${YOUTUBE_API_BASE}/playlistItems`);
      url.searchParams.set('part', 'snippet,contentDetails');
      url.searchParams.set('playlistId', likedPlaylistId);
      url.searchParams.set('maxResults', '50');
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

        // Check if we already have this video for this user
        const existing = await prisma.content.findUnique({
          where: {
            userId_platform_externalId: {
              userId,
              platform: Platform.YOUTUBE,
              externalId: videoId,
            },
          },
        });

        if (existing) {
          // If we found an existing video, we've likely synced up to this point
          // Could continue for full sync or break for incremental
          continue;
        }

        // Get thumbnail URL (prefer high quality)
        const thumbnailUrl =
          item.snippet.thumbnails.high?.url ||
          item.snippet.thumbnails.medium?.url ||
          item.snippet.thumbnails.default?.url ||
          null;

        // Create content entry
        await prisma.content.create({
          data: {
            userId,
            platform: Platform.YOUTUBE,
            externalId: videoId,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            title: item.snippet.title,
            description: item.snippet.description?.substring(0, 1000) || null,
            thumbnailUrl,
            capturedAt: new Date(item.snippet.publishedAt),
            status: ContentStatus.INBOX,
          },
        });

        newVideosCount++;
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

    console.log(`[YouTube Sync] User ${userId}: synced ${newVideosCount} new videos`);
    return newVideosCount;

  } catch (error) {
    console.error(`[YouTube Sync] Error for user ${userId}:`, error);
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
  console.log('[YouTube Sync] Starting sync job...');
  const startTime = Date.now();

  // Get all active YouTube connections
  const connections = await prisma.connectedPlatform.findMany({
    where: { platform: Platform.YOUTUBE },
    include: { user: true },
  });

  console.log(`[YouTube Sync] Found ${connections.length} YouTube connections`);

  let totalNewVideos = 0;
  let successCount = 0;
  let errorCount = 0;

  for (const connection of connections) {
    try {
      const newVideos = await syncUserYouTube(connection.userId, connection.id);
      totalNewVideos += newVideos;
      successCount++;
    } catch (error) {
      console.error(`[YouTube Sync] Failed for user ${connection.userId}:`, error);
      errorCount++;
    }

    // Small delay between users to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const duration = Date.now() - startTime;
  console.log(`[YouTube Sync] Completed in ${duration}ms`);
  console.log(`[YouTube Sync] Results: ${successCount} success, ${errorCount} errors, ${totalNewVideos} new videos`);
}
