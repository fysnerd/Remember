// TikTok Sync Worker - Fetches liked videos using browser automation
// Uses Playwright with stored session cookies to access private likes
import { logger } from '../config/logger.js';
import { prisma } from '../config/database.js';
import { Platform, ContentStatus } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { tiktokLimiter } from '../utils/rateLimiter.js';

const log = logger.child({ job: 'tiktok-sync' });

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
    log.error({ connectionId }, 'Connection not found');
    return 0;
  }

  // Parse stored cookies
  let cookies: TikTokCookies;
  try {
    cookies = JSON.parse(connection.accessToken) as TikTokCookies;
  } catch (error) {
    log.error({ userId }, 'Invalid cookies for user');
    await prisma.connectedPlatform.update({
      where: { id: connectionId },
      data: { lastSyncError: 'Invalid cookies format' },
    });
    return 0;
  }

  if (!cookies.sessionid) {
    log.error({ userId }, 'Missing sessionid for user');
    await prisma.connectedPlatform.update({
      where: { id: connectionId },
      data: { lastSyncError: 'Missing sessionid cookie' },
    });
    return 0;
  }

  let newVideosCount = 0;
  let foundExisting = false; // Flag to stop when we find existing content (incremental sync)

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

    // Launch headless browser with larger viewport
    const browser = await chromium.launch({ headless: true });
    try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      locale: 'en-US',
    });

    // Inject cookies
    await context.addCookies(playwrightCookies);

    const page = await context.newPage();

    // Intercept API responses to capture liked videos
    page.on('response', async (response) => {
      const url = response.url();

      // Capture liked videos - ONLY from favorite/item_list endpoint (not post/item_list)
      if (url.includes('favorite/item_list') || url.includes('api/favorite/')) {
        try {
          const data = await response.json();
          if (data.itemList && Array.isArray(data.itemList)) {
            log.debug({ userId, videoCount: data.itemList.length }, 'Found liked videos in API response');
            likedVideos.push(...data.itemList);
          }
        } catch (e) {
          log.debug({ userId }, 'Failed to parse favorite response');
        }
      }
    });

    // Navigate to profile and wait for full load
    log.debug({ userId }, 'Navigating to profile');
    await page.goto('https://www.tiktok.com/profile', { waitUntil: 'networkidle' });
    log.debug({ userId }, 'Page loaded, waiting for dynamic content');
    await page.waitForTimeout(5000);

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

    // Wait for tabs to appear (they load dynamically)
    log.debug({ userId }, 'Waiting for Liked tab to appear');
    try {
      await page.waitForSelector('text=Liked', { timeout: 10000 });
      log.debug({ userId }, 'Found "Liked" text on page');
    } catch {
      log.debug({ userId }, 'Liked text not found, trying A aimé');
      try {
        await page.waitForSelector('text=A aimé', { timeout: 5000 });
        log.debug({ userId }, 'Found "A aimé" text on page');
      } catch {
        log.debug({ userId }, 'Neither Liked nor A aimé found - tabs may not be rendered');
      }
    }

    // Check current URL after navigation
    const currentUrl = page.url();
    log.debug({ userId, currentUrl }, 'Current URL after navigation');

    // Take screenshot for debug
    const debugDir = path.join(os.tmpdir(), 'tiktok-debug');
    if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
    const screenshotPath = path.join(debugDir, `profile-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath });
    log.debug({ userId, screenshotPath }, 'Debug screenshot saved');

    // Extract username from current URL for direct navigation
    const usernameMatch = currentUrl.match(/@([^/?]+)/);
    const username = usernameMatch ? usernameMatch[1] : null;
    log.debug({ userId, username: username || 'NOT FOUND' }, 'Detected username');

    // List all available tabs using JavaScript
    const tabsInfo = await page.evaluate(() => {
      const results: string[] = [];
      // Look for common tab patterns
      document.querySelectorAll('[role="tab"], [data-e2e*="tab"], [class*="Tab"]').forEach(el => {
        results.push(`${el.tagName}: ${el.textContent?.trim().substring(0, 30)} | data-e2e=${el.getAttribute('data-e2e')}`);
      });
      return results;
    });
    log.debug({ userId, tabCount: tabsInfo.length, tabs: tabsInfo }, 'Available tabs found');

    // Try clicking on "Liked" tab using Playwright's powerful selectors
    log.debug({ userId }, 'Attempting to click on Liked tab');

    let clickedLikedTab = false;

    // Method 1: Click by exact text "Liked" (case-insensitive)
    try {
      const likedByText = page.getByText('Liked', { exact: true });
      if (await likedByText.count() > 0) {
        await likedByText.first().click();
        log.debug({ userId, method: 'getByText(Liked)' }, 'Clicked Liked tab');
        clickedLikedTab = true;
      }
    } catch (e) {
      log.debug({ userId }, 'getByText(Liked) failed');
    }

    // Method 2: Try French "A aimé"
    if (!clickedLikedTab) {
      try {
        const aiméByText = page.getByText('A aimé', { exact: true });
        if (await aiméByText.count() > 0) {
          await aiméByText.first().click();
          log.debug({ userId, method: 'getByText(A aimé)' }, 'Clicked Liked tab');
          clickedLikedTab = true;
        }
      } catch (e) {
        log.debug({ userId }, 'getByText(A aimé) failed');
      }
    }

    // Method 3: Click by role tab
    if (!clickedLikedTab) {
      try {
        const tabs = page.getByRole('tab');
        const count = await tabs.count();
        log.debug({ userId, tabCount: count }, 'Found tabs by role');
        for (let i = 0; i < count; i++) {
          const tabText = await tabs.nth(i).textContent();
          log.debug({ userId, tabIndex: i, tabText }, 'Checking tab');
          if (tabText?.toLowerCase().includes('liked') || tabText?.toLowerCase().includes('aimé')) {
            await tabs.nth(i).click();
            log.debug({ userId, tabIndex: i, tabText, method: 'role' }, 'Clicked Liked tab');
            clickedLikedTab = true;
            break;
          }
        }
      } catch (e) {
        log.debug({ userId }, 'Role-based tab search failed');
      }
    }

    // Method 4: Use CSS selector with data-e2e
    if (!clickedLikedTab) {
      try {
        const likedTab = await page.$('[data-e2e="liked-tab"], [data-e2e*="liked"]');
        if (likedTab) {
          await likedTab.click();
          log.debug({ userId, method: 'data-e2e' }, 'Clicked Liked tab');
          clickedLikedTab = true;
        }
      } catch (e) {
        log.debug({ userId }, 'data-e2e selector failed');
      }
    }

    // Method 5: XPath for any span containing "Liked"
    if (!clickedLikedTab) {
      try {
        const likedSpan = await page.$('xpath=//span[contains(text(), "Liked")]');
        if (likedSpan) {
          await likedSpan.click();
          log.debug({ userId, method: 'xpath' }, 'Clicked Liked tab');
          clickedLikedTab = true;
        }
      } catch (e) {
        log.debug({ userId }, 'XPath selector failed');
      }
    }

    if (clickedLikedTab) {
      log.debug({ userId }, 'Waiting for Liked content to load');
      await page.waitForTimeout(4000);

      // Take screenshot to confirm we're on Liked tab
      const likesScreenshot = path.join(debugDir, `liked-tab-${Date.now()}.png`);
      await page.screenshot({ path: likesScreenshot });
      log.debug({ userId, likesScreenshot }, 'Liked tab screenshot saved');
    } else {
      log.error({ userId }, 'FAILED to click Liked tab with all methods');
      const errorScreenshot = path.join(debugDir, `failed-click-${Date.now()}.png`);
      await page.screenshot({ path: errorScreenshot, fullPage: true });
      log.debug({ userId, errorScreenshot }, 'Error screenshot saved');
    }

    // Scroll to load videos regardless of how we got here
    log.debug({ userId }, 'Scrolling to load videos');
    const maxScrolls = 15;
    const maxVideos = 15;
    for (let i = 0; i < maxScrolls && !foundExisting && likedVideos.length < maxVideos; i++) {
      const prevCount = likedVideos.length;
      await page.mouse.wheel(0, 800);
      await page.waitForTimeout(1500);

      // Check if any of the newly captured videos already exist in DB
      for (const video of likedVideos) {
        const existing = await prisma.content.findUnique({
          where: {
            userId_platform_externalId: {
              userId,
              platform: Platform.TIKTOK,
              externalId: video.id,
            },
          },
          select: { id: true },
        });
        if (existing) {
          log.info({ userId, videoId: video.id }, 'Found existing video - stopping (incremental sync complete)');
          foundExisting = true;
          break;
        }
      }

      if (foundExisting) break;

      if (likedVideos.length > 0) {
        log.debug({ userId, scrollNumber: i + 1, videoCount: likedVideos.length }, 'Scroll progress');
      }

      // Stop if no new videos loaded after 3 scrolls
      if (i > 3 && likedVideos.length === prevCount) {
        log.debug({ userId, scrollCount: i }, 'No more videos to load');
        break;
      }
    }

    // If still no liked videos, check if likes might be private
    if (likedVideos.length === 0) {
      log.error({ userId }, 'WARNING: No liked videos found. Possible causes: 1. Likes set to PRIVATE 2. Cookies expired 3. TikTok UI changed');
      const errorScreenshot = path.join(debugDir, `no-likes-${Date.now()}.png`);
      await page.screenshot({ path: errorScreenshot, fullPage: true });
      log.debug({ userId, errorScreenshot }, 'Error screenshot saved');
    }

    log.info({ userId, videoCount: likedVideos.length }, 'Found liked videos');

    // Deduplicate videos
    const seenIds = new Set<string>();
    const uniqueVideos = likedVideos.filter((video) => {
      if (seenIds.has(video.id)) return false;
      seenIds.add(video.id);
      return true;
    });

    // Process each video - STOP when we find one that already exists (incremental sync)
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
        select: { id: true },
      });

      if (existing) {
        // STOP - we've reached previously synced content
        log.info({ userId, videoId: video.id }, 'Found existing video during save - stopping');
        break;
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

    log.info({ userId, videoCount: newVideosCount }, 'New content synced');
    return newVideosCount;

    } finally {
      await browser.close();
    }

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
 * Main sync function - syncs all connected TikTok accounts
 */
export async function runTikTokSync(): Promise<void> {
  log.info('Starting sync');
  const startTime = Date.now();

  // Get all active TikTok connections
  const connections = await prisma.connectedPlatform.findMany({
    where: { platform: Platform.TIKTOK },
    include: { user: true },
  });

  log.info({ userCount: connections.length }, 'Found users to sync');

  let totalNewVideos = 0;
  let successCount = 0;
  let errorCount = 0;

  const TIMEOUT_MS = 60000; // 60s timeout per user

  const results = await Promise.allSettled(
    connections.map(connection =>
      tiktokLimiter(() =>
        Promise.race([
          syncUserTikTok(connection.userId, connection.id),
          new Promise<number>((_, reject) =>
            setTimeout(() => reject(new Error(`TikTok sync timeout for user ${connection.userId}`)), TIMEOUT_MS)
          ),
        ])
      )
    )
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      totalNewVideos += result.value;
      successCount++;
    } else {
      log.error({ err: result.reason }, 'User sync failed');
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
