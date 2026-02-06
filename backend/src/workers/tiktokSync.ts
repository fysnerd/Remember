// TikTok Sync Worker - Fetches liked videos using browser automation
// Uses Playwright with stored session cookies to access private likes
import { prisma } from '../config/database.js';
import { Platform, ContentStatus } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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

      // Log all TikTok API calls for debugging
      if (url.includes('tiktok.com/api/') || url.includes('/v1/')) {
        console.log(`[TikTok Sync] API call: ${url.split('?')[0]} (status: ${response.status()})`);
      }

      // Capture liked videos - ONLY from favorite/item_list endpoint (not post/item_list)
      if (url.includes('favorite/item_list') || url.includes('api/favorite/')) {
        console.log(`[TikTok Sync] ★ Intercepted LIKED videos API: ${url.substring(0, 100)}`);
        try {
          const data = await response.json();
          console.log(`[TikTok Sync] Response keys: ${Object.keys(data).join(', ')}`);
          if (data.itemList && Array.isArray(data.itemList)) {
            console.log(`[TikTok Sync] ★ Found ${data.itemList.length} LIKED videos in response`);
            likedVideos.push(...data.itemList);
          }
        } catch (e) {
          console.log(`[TikTok Sync] Failed to parse response: ${e}`);
        }
      }
    });

    // Navigate to profile and wait for full load
    console.log(`[TikTok Sync] Navigating to profile for user ${userId}...`);
    await page.goto('https://www.tiktok.com/profile', { waitUntil: 'networkidle' });
    console.log(`[TikTok Sync] Page loaded, waiting for dynamic content...`);
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
    console.log(`[TikTok Sync] Waiting for Liked tab to appear...`);
    try {
      await page.waitForSelector('text=Liked', { timeout: 10000 });
      console.log(`[TikTok Sync] ✓ Found "Liked" text on page`);
    } catch {
      console.log(`[TikTok Sync] "Liked" text not found, trying "A aimé"...`);
      try {
        await page.waitForSelector('text=A aimé', { timeout: 5000 });
        console.log(`[TikTok Sync] ✓ Found "A aimé" text on page`);
      } catch {
        console.log(`[TikTok Sync] Neither "Liked" nor "A aimé" found - tabs may not be rendered`);
      }
    }

    // Check current URL after navigation
    const currentUrl = page.url();
    console.log(`[TikTok Sync] Current URL: ${currentUrl}`);

    // Take screenshot for debug
    const debugDir = path.join(os.tmpdir(), 'tiktok-debug');
    if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
    const screenshotPath = path.join(debugDir, `profile-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath });
    console.log(`[TikTok Sync] Debug screenshot saved: ${screenshotPath}`);

    // Extract username from current URL for direct navigation
    const usernameMatch = currentUrl.match(/@([^/?]+)/);
    const username = usernameMatch ? usernameMatch[1] : null;
    console.log(`[TikTok Sync] Detected username: ${username || 'NOT FOUND'}`);

    // List all available tabs using JavaScript
    const tabsInfo = await page.evaluate(() => {
      const results: string[] = [];
      // Look for common tab patterns
      document.querySelectorAll('[role="tab"], [data-e2e*="tab"], [class*="Tab"]').forEach(el => {
        results.push(`${el.tagName}: ${el.textContent?.trim().substring(0, 30)} | data-e2e=${el.getAttribute('data-e2e')}`);
      });
      return results;
    });
    console.log(`[TikTok Sync] Available tabs found: ${tabsInfo.length}`);
    tabsInfo.forEach(t => console.log(`[TikTok Sync]   - ${t}`));

    // Try clicking on "Liked" tab using Playwright's powerful selectors
    console.log(`[TikTok Sync] Attempting to click on Liked tab...`);

    let clickedLikedTab = false;

    // Method 1: Click by exact text "Liked" (case-insensitive)
    try {
      const likedByText = page.getByText('Liked', { exact: true });
      if (await likedByText.count() > 0) {
        await likedByText.first().click();
        console.log(`[TikTok Sync] ✓ Clicked via getByText('Liked')`);
        clickedLikedTab = true;
      }
    } catch (e) {
      console.log(`[TikTok Sync] getByText('Liked') failed: ${e}`);
    }

    // Method 2: Try French "A aimé"
    if (!clickedLikedTab) {
      try {
        const aiméByText = page.getByText('A aimé', { exact: true });
        if (await aiméByText.count() > 0) {
          await aiméByText.first().click();
          console.log(`[TikTok Sync] ✓ Clicked via getByText('A aimé')`);
          clickedLikedTab = true;
        }
      } catch (e) {
        console.log(`[TikTok Sync] getByText('A aimé') failed`);
      }
    }

    // Method 3: Click by role tab
    if (!clickedLikedTab) {
      try {
        const tabs = page.getByRole('tab');
        const count = await tabs.count();
        console.log(`[TikTok Sync] Found ${count} tabs by role`);
        for (let i = 0; i < count; i++) {
          const tabText = await tabs.nth(i).textContent();
          console.log(`[TikTok Sync]   Tab ${i}: "${tabText}"`);
          if (tabText?.toLowerCase().includes('liked') || tabText?.toLowerCase().includes('aimé')) {
            await tabs.nth(i).click();
            console.log(`[TikTok Sync] ✓ Clicked tab ${i} with text "${tabText}"`);
            clickedLikedTab = true;
            break;
          }
        }
      } catch (e) {
        console.log(`[TikTok Sync] Role-based tab search failed: ${e}`);
      }
    }

    // Method 4: Use CSS selector with data-e2e
    if (!clickedLikedTab) {
      try {
        const likedTab = await page.$('[data-e2e="liked-tab"], [data-e2e*="liked"]');
        if (likedTab) {
          await likedTab.click();
          console.log(`[TikTok Sync] ✓ Clicked via data-e2e selector`);
          clickedLikedTab = true;
        }
      } catch (e) {
        console.log(`[TikTok Sync] data-e2e selector failed`);
      }
    }

    // Method 5: XPath for any span containing "Liked"
    if (!clickedLikedTab) {
      try {
        const likedSpan = await page.$('xpath=//span[contains(text(), "Liked")]');
        if (likedSpan) {
          await likedSpan.click();
          console.log(`[TikTok Sync] ✓ Clicked via XPath span`);
          clickedLikedTab = true;
        }
      } catch (e) {
        console.log(`[TikTok Sync] XPath selector failed`);
      }
    }

    if (clickedLikedTab) {
      console.log(`[TikTok Sync] Waiting for Liked content to load...`);
      await page.waitForTimeout(4000);

      // Take screenshot to confirm we're on Liked tab
      const likesScreenshot = path.join(debugDir, `liked-tab-${Date.now()}.png`);
      await page.screenshot({ path: likesScreenshot });
      console.log(`[TikTok Sync] Liked tab screenshot: ${likesScreenshot}`);
    } else {
      console.error(`[TikTok Sync] ✗ FAILED to click Liked tab with all methods!`);
      const errorScreenshot = path.join(debugDir, `failed-click-${Date.now()}.png`);
      await page.screenshot({ path: errorScreenshot, fullPage: true });
      console.log(`[TikTok Sync] Error screenshot: ${errorScreenshot}`);
    }

    // Scroll to load videos regardless of how we got here
    console.log(`[TikTok Sync] Scrolling to load videos...`);
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
          console.log(`[TikTok Sync] ✓ Found existing video ${video.id} - stopping (incremental sync complete)`);
          foundExisting = true;
          break;
        }
      }

      if (foundExisting) break;

      if (likedVideos.length > 0) {
        console.log(`[TikTok Sync] Scroll ${i + 1}: captured ${likedVideos.length} LIKED videos`);
      }

      // Stop if no new videos loaded after 3 scrolls
      if (i > 3 && likedVideos.length === prevCount) {
        console.log(`[TikTok Sync] No more videos to load after ${i} scrolls`);
        break;
      }
    }

    // If still no liked videos, check if likes might be private
    if (likedVideos.length === 0) {
      console.error(`[TikTok Sync] WARNING: No liked videos found. Possible causes:`);
      console.error(`[TikTok Sync]   1. Likes are set to PRIVATE in TikTok settings`);
      console.error(`[TikTok Sync]   2. Session cookies expired`);
      console.error(`[TikTok Sync]   3. TikTok UI changed`);
      const errorScreenshot = path.join(debugDir, `no-likes-${Date.now()}.png`);
      await page.screenshot({ path: errorScreenshot, fullPage: true });
      console.log(`[TikTok Sync] Error screenshot saved: ${errorScreenshot}`);
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
        console.log(`[TikTok Sync] ✓ Found existing video ${video.id} during save - stopping`);
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
