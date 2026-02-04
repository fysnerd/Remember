// TikTok Sync Worker - Fetches liked videos using browser automation
// Uses Playwright with stored session cookies to access private likes
import { prisma } from '../config/database.js';
import { Platform, ContentStatus } from '@prisma/client';

interface TikTokCookies {
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

interface TikTokVideo {
  id: string;
  desc: string;
  author: {
    uniqueId: string;
    nickname?: string;
  };
  stats: {
    playCount: number;
    diggCount: number;
    commentCount: number;
    shareCount: number;
  };
  video: {
    duration: number;
    cover?: string;
  };
  createTime: number;
}

/**
 * Fetch liked videos from TikTok for a specific user using browser automation
 */
async function syncUserTikTok(userId: string, connectionId: string): Promise<number> {
  const connection = await prisma.connectedPlatform.findUnique({
    where: { id: connectionId },
  });

  if (!connection) {
    console.error(`[TikTok Sync] Connection ${connectionId} not found`);
    return 0;
  }

  // Parse stored cookies
  let cookies: TikTokCookies;
  try {
    cookies = JSON.parse(connection.accessToken) as TikTokCookies;
  } catch (error) {
    console.error(`[TikTok Sync] Invalid cookies for user ${userId}`);
    await prisma.connectedPlatform.update({
      where: { id: connectionId },
      data: { lastSyncError: 'Invalid cookies format' },
    });
    return 0;
  }

  if (!cookies.sessionid) {
    console.error(`[TikTok Sync] Missing sessionid for user ${userId}`);
    await prisma.connectedPlatform.update({
      where: { id: connectionId },
      data: { lastSyncError: 'Missing sessionid cookie' },
    });
    return 0;
  }

  let newVideosCount = 0;

  try {
    // Dynamic import of playwright to avoid issues if not installed
    const { chromium } = await import('playwright');

    // Convert cookies to Playwright format
    const playwrightCookies = Object.entries(cookies).map(([name, value]) => ({
      name,
      value: value as string,
      domain: '.tiktok.com',
      path: '/',
    }));

    const likedVideos: TikTokVideo[] = [];

    // Launch headless browser
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    // Inject cookies
    await context.addCookies(playwrightCookies);

    const page = await context.newPage();

    // Intercept API responses to capture liked videos
    page.on('response', async (response) => {
      if (response.url().includes('favorite/item_list')) {
        try {
          const data = await response.json();
          if (data.itemList && Array.isArray(data.itemList)) {
            likedVideos.push(...data.itemList);
          }
        } catch {
          // Ignore JSON parse errors
        }
      }
    });

    // Navigate to profile
    console.log(`[TikTok Sync] Navigating to profile for user ${userId}...`);
    await page.goto('https://www.tiktok.com/profile', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Close cookie popup if present
    try {
      const declineBtn = await page.$('button:has-text("Decline")');
      if (declineBtn) {
        await declineBtn.click();
        await page.waitForTimeout(1000);
      }
    } catch {
      // Ignore if popup not found
    }

    // Click on liked tab
    const likedTab = await page.$('[data-e2e="liked-tab"]') ||
                     await page.$('p:has-text("A aimé")') ||
                     await page.$('span:has-text("Liked")');

    if (likedTab) {
      await likedTab.click();
      await page.waitForTimeout(4000);

      // Scroll to load more videos (up to 20 scrolls for ~300 videos)
      const maxScrolls = 20;
      for (let i = 0; i < maxScrolls; i++) {
        const prevCount = likedVideos.length;
        await page.mouse.wheel(0, 800);
        await page.waitForTimeout(1500);

        // Stop if no new videos loaded after 3 scrolls
        if (i > 3 && likedVideos.length === prevCount) {
          console.log(`[TikTok Sync] No more videos to load after ${i} scrolls`);
          break;
        }
      }
    }

    await browser.close();

    console.log(`[TikTok Sync] User ${userId}: found ${likedVideos.length} liked videos`);

    // Deduplicate videos
    const seenIds = new Set<string>();
    const uniqueVideos = likedVideos.filter((video) => {
      if (seenIds.has(video.id)) return false;
      seenIds.add(video.id);
      return true;
    });

    // Process each video
    for (const video of uniqueVideos) {
      // Check if we already have this video for this user
      const existing = await prisma.content.findUnique({
        where: {
          userId_platform_externalId: {
            userId,
            platform: Platform.TIKTOK,
            externalId: video.id,
          },
        },
      });

      if (existing) {
        continue;
      }

      // Create content entry
      const authorUsername = video.author.uniqueId;
      await prisma.content.create({
        data: {
          userId,
          platform: Platform.TIKTOK,
          externalId: video.id,
          url: `https://www.tiktok.com/@${authorUsername}/video/${video.id}`,
          title: video.desc?.substring(0, 255) || `TikTok by @${authorUsername}`,
          description: video.desc || null,
          thumbnailUrl: video.video?.cover || null,
          duration: video.video?.duration || null,
          authorUsername,
          channelName: `@${authorUsername}`,  // Unified field for frontend
          viewCount: video.stats?.playCount || null,
          capturedAt: new Date(video.createTime * 1000),
          status: ContentStatus.INBOX,
        },
      });

      newVideosCount++;
    }

    // Update last sync time
    await prisma.connectedPlatform.update({
      where: { id: connectionId },
      data: {
        lastSyncAt: new Date(),
        lastSyncError: null,
      },
    });

    console.log(`[TikTok Sync] User ${userId}: synced ${newVideosCount} new videos`);
    return newVideosCount;

  } catch (error) {
    console.error(`[TikTok Sync] Error for user ${userId}:`, error);
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
 * Main sync function - syncs all connected TikTok accounts
 */
export async function runTikTokSync(): Promise<void> {
  console.log('[TikTok Sync] Starting sync job...');
  const startTime = Date.now();

  // Get all active TikTok connections
  const connections = await prisma.connectedPlatform.findMany({
    where: { platform: Platform.TIKTOK },
    include: { user: true },
  });

  console.log(`[TikTok Sync] Found ${connections.length} TikTok connections`);

  let totalNewVideos = 0;
  let successCount = 0;
  let errorCount = 0;

  for (const connection of connections) {
    try {
      const newVideos = await syncUserTikTok(connection.userId, connection.id);
      totalNewVideos += newVideos;
      successCount++;
    } catch (error) {
      console.error(`[TikTok Sync] Failed for user ${connection.userId}:`, error);
      errorCount++;
    }

    // Longer delay between users (TikTok is more sensitive to automation)
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  const duration = Date.now() - startTime;
  console.log(`[TikTok Sync] Completed in ${duration}ms`);
  console.log(`[TikTok Sync] Results: ${successCount} success, ${errorCount} errors, ${totalNewVideos} new videos`);
}

/**
 * Sync TikTok for a single user (on-demand)
 */
export async function syncTikTokForUser(userId: string): Promise<number> {
  const connection = await prisma.connectedPlatform.findUnique({
    where: {
      userId_platform: {
        userId,
        platform: Platform.TIKTOK,
      },
    },
  });

  if (!connection) {
    throw new Error('TikTok not connected');
  }

  return syncUserTikTok(userId, connection.id);
}
