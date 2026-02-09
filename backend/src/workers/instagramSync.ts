// Instagram Sync Worker - Fetches LIKED reels only using browser automation
// Uses Playwright with stored session cookies to access private likes
// STOPS when it finds content already in DB (incremental sync)
import { prisma } from '../config/database.js';
import { Platform, ContentStatus } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface InstagramCookies {
  sessionid: string;
  csrftoken?: string;
  ds_user_id?: string;
  mid?: string;
  ig_did?: string;
  ig_nrcb?: string;
  rur?: string;
  datr?: string;
}

interface InstagramReel {
  id: string;
  code: string;
  caption?: { text?: string };
  user: { username: string; full_name?: string };
  like_count?: number;
  comment_count?: number;
  video_duration?: number;
  image_versions2?: { candidates?: Array<{ url: string }> };
  taken_at?: number;
  media_type?: number;
}

/**
 * Check if content already exists in DB for this user
 */
async function contentExists(userId: string, externalId: string): Promise<boolean> {
  const existing = await prisma.content.findUnique({
    where: {
      userId_platform_externalId: {
        userId,
        platform: Platform.INSTAGRAM,
        externalId,
      },
    },
    select: { id: true },
  });
  return existing !== null;
}

/**
 * Fetch LIKED reels from Instagram for a specific user
 */
async function syncUserInstagram(userId: string, connectionId: string): Promise<number> {
  const connection = await prisma.connectedPlatform.findUnique({
    where: { id: connectionId },
  });

  if (!connection) {
    console.error(`[Instagram Sync] Connection ${connectionId} not found`);
    return 0;
  }

  let cookies: InstagramCookies;
  try {
    cookies = JSON.parse(connection.accessToken) as InstagramCookies;
  } catch {
    console.error(`[Instagram Sync] Invalid cookies for user ${userId}`);
    await prisma.connectedPlatform.update({
      where: { id: connectionId },
      data: { lastSyncError: 'Invalid cookies format' },
    });
    return 0;
  }

  if (!cookies.sessionid) {
    console.error(`[Instagram Sync] Missing sessionid for user ${userId}`);
    await prisma.connectedPlatform.update({
      where: { id: connectionId },
      data: { lastSyncError: 'Missing sessionid cookie' },
    });
    return 0;
  }

  let newReelsCount = 0;
  let foundExisting = false; // Flag to stop when we find existing content

  try {
    const { chromium } = await import('playwright');

    const playwrightCookies = Object.entries(cookies)
      .filter(([_, value]) => value !== undefined)
      .map(([name, value]) => ({
        name,
        value: value as string,
        domain: '.instagram.com',
        path: '/',
      }));

    const likedReels: InstagramReel[] = [];

    // Launch browser with anti-detection options
    const browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--no-sandbox',
      ]
    });
    // Use iPhone user agent - Instagram is less aggressive with mobile
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      locale: 'fr-FR',
      timezoneId: 'Europe/Paris',
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      javaScriptEnabled: true,
    });

    // Remove webdriver flag to avoid detection
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      // @ts-ignore
      window.chrome = { runtime: {} };
    });

    await context.addCookies(playwrightCookies);
    const page = await context.newPage();

    // Debug directory
    const debugDir = path.join(os.tmpdir(), 'instagram-debug');
    if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });

    // Intercept API responses for liked reels
    page.on('response', async (response) => {
      if (foundExisting) return; // Stop intercepting once we found existing content

      const url = response.url();
      try {
        // Liked posts API (REST)
        if (url.includes('/api/v1/feed/liked/') || url.includes('liked_posts')) {
          const data = await response.json();
          if (data.items && Array.isArray(data.items)) {
            for (const item of data.items) {
              const media = item.media || item;
              if (media.media_type === 2 || media.product_type === 'clips') {
                likedReels.push(media);
              }
            }
            console.log(`[Instagram Sync] ★ Intercepted ${likedReels.length} liked reels via REST API`);
          }
        }

        // GraphQL API for likes
        if (url.includes('/graphql') || url.includes('/api/graphql')) {
          const data = await response.json();
          const likedConnection = data?.data?.xdt_api__v1__feed__liked__connection ||
                                   data?.data?.xdt_api__v1__users__self__liked_media__connection;
          if (likedConnection?.edges) {
            for (const edge of likedConnection.edges) {
              const media = edge?.node?.media || edge?.node;
              if (media && (media.media_type === 2 || media.product_type === 'clips')) {
                likedReels.push(media);
              }
            }
            if (likedReels.length > 0) {
              console.log(`[Instagram Sync] ★ Intercepted ${likedReels.length} liked reels via GraphQL`);
            }
          }
        }
      } catch {
        // Ignore JSON parse errors
      }
    });

    // Navigate to Instagram with human-like delay
    console.log(`[Instagram Sync] Navigating to Instagram for user ${userId}...`);
    await page.waitForTimeout(1000 + Math.random() * 2000); // Random delay before navigating
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000 + Math.random() * 2000); // Wait for dynamic content

    // Close any Instagram popups (save login info, notifications, etc.)
    const popupSelectors = [
      'button:has-text("Plus tard")',
      'button:has-text("Not Now")',
      'button:has-text("Pas maintenant")',
      '[aria-label="Close"]',
      '[aria-label="Fermer"]',
      'div[role="dialog"] button:last-child', // Usually the dismiss button
    ];
    for (const selector of popupSelectors) {
      try {
        const popup = page.locator(selector).first();
        if (await popup.isVisible({ timeout: 2000 })) {
          await popup.click();
          console.log(`[Instagram Sync] Closed popup with selector: ${selector}`);
          await page.waitForTimeout(1000);
        }
      } catch {
        // Popup not found, continue
      }
    }

    // Check if logged in
    if (page.url().includes('/accounts/login')) {
      console.error(`[Instagram Sync] Cookies expired for user ${userId}`);
      await browser.close();
      await prisma.connectedPlatform.update({
        where: { id: connectionId },
        data: { lastSyncError: 'Session expired. Please reconnect.' },
      });
      return 0;
    }

    // Navigate to liked posts page
    console.log(`[Instagram Sync] Going to liked posts page...`);
    await page.goto('https://www.instagram.com/your_activity/interactions/likes/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);

    // Close any popups again (they can appear after navigation)
    for (const selector of popupSelectors) {
      try {
        const popup = page.locator(selector).first();
        if (await popup.isVisible({ timeout: 1000 })) {
          await popup.click();
          console.log(`[Instagram Sync] Closed popup on likes page: ${selector}`);
          await page.waitForTimeout(1000);
        }
      } catch {
        // Popup not found, continue
      }
    }
    await page.waitForTimeout(2000);

    // Screenshot for debug
    const screenshot = path.join(debugDir, `likes-page-${Date.now()}.png`);
    await page.screenshot({ path: screenshot });
    console.log(`[Instagram Sync] Screenshot: ${screenshot}`);

    if (!page.url().includes('/your_activity/interactions/likes')) {
      console.warn(`[Instagram Sync] Could not access likes page`);
      await browser.close();
      return 0;
    }

    // DOM-based extraction: click on grid items and check URLs
    const maxLikesToCheck = 50;
    let likesChecked = 0;
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 5;

    console.log(`[Instagram Sync] Starting DOM extraction of liked reels...`);

    // Debug: Log page structure
    const pageContent = await page.content();
    console.log(`[Instagram Sync] Page HTML length: ${pageContent.length}`);

    // Try multiple selectors for Instagram's grid
    const selectors = [
      'main div[role="button"]',
      'main button:has(img)',
      'article div[role="button"]',
      'div[style*="flex"] > div > div > a',
      'a[href*="/reel/"]',
      'a[href*="/p/"]',
      'div._aagw',  // Instagram's grid item class
      'div._aabd',  // Another common class
    ];

    let gridItems: any = null;
    let usedSelector = '';

    for (const selector of selectors) {
      const items = page.locator(selector);
      const count = await items.count();
      console.log(`[Instagram Sync] Selector "${selector}": ${count} items`);
      if (count > 0 && !gridItems) {
        gridItems = items;
        usedSelector = selector;
      }
    }

    if (!gridItems || await gridItems.count() === 0) {
      console.error(`[Instagram Sync] No grid items found with any selector!`);
      const errorScreenshot = path.join(debugDir, `no-items-${Date.now()}.png`);
      await page.screenshot({ path: errorScreenshot, fullPage: true });
      console.log(`[Instagram Sync] Error screenshot: ${errorScreenshot}`);
      await browser.close();
      return 0;
    }

    console.log(`[Instagram Sync] Using selector: "${usedSelector}" (${await gridItems.count()} items)`);

    while (likesChecked < maxLikesToCheck && consecutiveErrors < maxConsecutiveErrors && !foundExisting) {
      try {
        // Refresh the locator count
        const count = await gridItems.count();

        if (count === 0) {
          console.log(`[Instagram Sync] No more liked items to check`);
          break;
        }

        // Click on the first available item (after scrolling, new items appear at top)
        const itemIndex = Math.min(likesChecked, count - 1);
        console.log(`[Instagram Sync] Clicking item ${itemIndex}/${count}...`);
        await gridItems.nth(itemIndex).click();
        await page.waitForTimeout(2000);

        // Check URL to see if it's a reel
        const currentUrl = page.url();
        const reelMatch = currentUrl.match(/\/reel\/([A-Za-z0-9_-]+)/);

        if (reelMatch) {
          const shortcode = reelMatch[1];

          // CHECK IF ALREADY EXISTS - if yes, STOP (we've reached previous sync point)
          const exists = await contentExists(userId, shortcode);
          if (exists) {
            console.log(`[Instagram Sync] ✓ Found existing reel ${shortcode} - stopping (incremental sync complete)`);
            foundExisting = true;
            break;
          }

          likedReels.push({
            id: shortcode,
            code: shortcode,
            user: { username: 'unknown' },
          } as InstagramReel);
          console.log(`[Instagram Sync] Found NEW liked reel: ${shortcode}`);
        }

        likesChecked++;
        consecutiveErrors = 0;

        // Navigate back to likes page
        await page.goto('https://www.instagram.com/your_activity/interactions/likes/', {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });
        await page.waitForTimeout(2000);

        // Re-acquire the grid items locator after navigation
        gridItems = page.locator(usedSelector);

        // Scroll to load more items
        await page.mouse.wheel(0, 200);
        await page.waitForTimeout(1000);

      } catch (error) {
        console.warn(`[Instagram Sync] Error extracting liked item:`, error);
        consecutiveErrors++;
        console.log(`[Instagram Sync] Consecutive errors: ${consecutiveErrors}/${maxConsecutiveErrors}`);

        try {
          await page.goto('https://www.instagram.com/your_activity/interactions/likes/', { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(2000);
        } catch {
          break;
        }
      }
    }

    await browser.close();

    console.log(`[Instagram Sync] Extraction complete:`);
    console.log(`[Instagram Sync]   - Items checked: ${likesChecked}`);
    console.log(`[Instagram Sync]   - Reels found: ${likedReels.length}`);
    console.log(`[Instagram Sync]   - Stopped early (found existing): ${foundExisting}`);

    // Deduplicate
    const seenIds = new Set<string>();
    const uniqueReels = likedReels.filter((reel) => {
      const id = reel.id || reel.code;
      if (!id || seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });

    // Save to DB
    for (const reel of uniqueReels) {
      const externalId = reel.id || reel.code;
      const shortcode = reel.code || externalId;
      const url = `https://www.instagram.com/reel/${shortcode}/`;
      const authorUsername = reel.user?.username || null;

      // Double-check doesn't exist (might have been added by API interception)
      const exists = await contentExists(userId, externalId);
      if (exists) continue;

      await prisma.content.create({
        data: {
          userId,
          platform: Platform.INSTAGRAM,
          externalId,
          url,
          title: reel.caption?.text?.substring(0, 255) || `Instagram Reel`,
          description: reel.caption?.text || null,
          thumbnailUrl: reel.image_versions2?.candidates?.[0]?.url || null,
          duration: reel.video_duration || null,
          authorUsername,
          channelName: authorUsername ? `@${authorUsername}` : null,
          likeCount: reel.like_count || null,
          commentCount: reel.comment_count || null,
          capturedAt: reel.taken_at ? new Date(reel.taken_at * 1000) : new Date(),
          status: ContentStatus.INBOX,
        },
      });
      newReelsCount++;
    }

    // Update last sync time
    await prisma.connectedPlatform.update({
      where: { id: connectionId },
      data: { lastSyncAt: new Date(), lastSyncError: null },
    });

    console.log(`[Instagram Sync] User ${userId}: synced ${newReelsCount} NEW reels`);
    return newReelsCount;

  } catch (error) {
    console.error(`[Instagram Sync] Error for user ${userId}:`, error);
    await prisma.connectedPlatform.update({
      where: { id: connectionId },
      data: { lastSyncError: error instanceof Error ? error.message : 'Unknown error' },
    });
    return 0;
  }
}

/**
 * Main sync function - syncs all connected Instagram accounts
 */
export async function runInstagramSync(): Promise<void> {
  console.log('[Instagram Sync] Starting sync job...');
  const startTime = Date.now();

  const connections = await prisma.connectedPlatform.findMany({
    where: { platform: Platform.INSTAGRAM },
    include: { user: true },
  });

  console.log(`[Instagram Sync] Found ${connections.length} Instagram connections`);

  let totalNewReels = 0;
  let successCount = 0;
  let errorCount = 0;

  for (const connection of connections) {
    try {
      const newReels = await syncUserInstagram(connection.userId, connection.id);
      totalNewReels += newReels;
      successCount++;
    } catch (error) {
      console.error(`[Instagram Sync] Failed for user ${connection.userId}:`, error);
      errorCount++;
    }
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  const duration = Date.now() - startTime;
  console.log(`[Instagram Sync] Completed in ${duration}ms`);
  console.log(`[Instagram Sync] Results: ${successCount} success, ${errorCount} errors, ${totalNewReels} new reels`);
}

/**
 * Sync Instagram for a single user (on-demand)
 */
export async function syncInstagramForUser(userId: string): Promise<number> {
  const connection = await prisma.connectedPlatform.findUnique({
    where: {
      userId_platform: { userId, platform: Platform.INSTAGRAM },
    },
  });

  if (!connection) {
    throw new Error('Instagram not connected');
  }

  return syncUserInstagram(userId, connection.id);
}
