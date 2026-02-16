// Instagram Sync Worker - Page navigation + passive interception:
// 1. Playwright browser for cookie auth + anti-detection
// 2. Navigate to likes page, intercept API responses passively
// The browser makes API calls naturally with the same Safari UA as cookie origin
// → No Barcelona UA mismatch, no suspicious activity warnings
import { logger } from '../config/logger.js';
import { prisma } from '../config/database.js';
import { Platform, ContentStatus } from '@prisma/client';
import { instagramLimiter } from '../utils/rateLimiter.js';

const log = logger.child({ job: 'instagram-sync' });

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


/**
 * Fetch LIKED reels from Instagram for a specific user
 */
async function syncUserInstagram(userId: string, connectionId: string): Promise<number> {
  const connection = await prisma.connectedPlatform.findUnique({
    where: { id: connectionId },
  });

  if (!connection) {
    log.error({ connectionId }, 'Connection not found');
    return 0;
  }

  let cookies: InstagramCookies;
  try {
    cookies = JSON.parse(connection.accessToken) as InstagramCookies;
  } catch {
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

  let newReelsCount = 0;

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

    // Launch browser with anti-detection
    const browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--no-sandbox',
      ]
    });

    // Match the WKWebView UA that created the cookies (NOT Safari — no "Version/Safari" suffix)
    // WKWebView format: ...AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/XXXXX
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22D72',
      locale: 'fr-FR',
      timezoneId: 'Europe/Paris',
      isMobile: true,
      hasTouch: true,
      javaScriptEnabled: true,
    });

    // Remove webdriver flag
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      // @ts-ignore
      window.chrome = { runtime: {} };
    });

    await context.addCookies(playwrightCookies);

    const page = await context.newPage();

    // Anti-detection jitter: random 3-10s delay before any request
    const jitterMs = 3000 + Math.random() * 7000;
    log.info({ userId, jitterMs: Math.round(jitterMs) }, 'Applying jitter before navigation');
    await new Promise(resolve => setTimeout(resolve, jitterMs));

    // Navigate directly to the likes page
    log.info({ userId }, 'Navigating to likes page');
    await page.goto('https://www.instagram.com/your_activity/interactions/likes/', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Check for login redirect (session expired)
    const finalUrl = page.url();
    if (finalUrl.includes('/accounts/login') || finalUrl.includes('/challenge/')) {
      log.warn({ userId, finalUrl }, 'Redirected to login — session expired');
      await browser.close();
      await prisma.connectedPlatform.update({
        where: { id: connectionId },
        data: { lastSyncError: 'Session expired. Please reconnect.' },
      });
      return 0;
    }

    log.info({ userId, finalUrl }, 'Likes page loaded');

    // Dismiss popups (cookies consent, notifications, etc.)
    try {
      for (const text of ['Not Now', 'Pas maintenant', 'Decline optional cookies', 'Refuser les cookies optionnels', 'Allow all cookies', 'Tout accepter']) {
        const btn = page.locator(`button:has-text("${text}")`).first();
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await btn.click();
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } catch { /* best-effort */ }

    // Wait for liked content to render — the SPA may need extra time
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Extract liked post data from the page DOM and embedded Relay store
    const extractedData = await page.evaluate(() => {
      const result: {
        postLinks: string[];
        relayItems: any[];
        scriptData: string[];
        debugInfo: string;
      } = { postLinks: [], relayItems: [], scriptData: [], debugInfo: '' };

      // Method 1: Extract post links from DOM <a href="/p/SHORTCODE/"> or <a href="/reel/SHORTCODE/">
      const links = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');
      const seen = new Set<string>();
      links.forEach(link => {
        const href = link.getAttribute('href') || '';
        const match = href.match(/\/(p|reel)\/([A-Za-z0-9_-]+)/);
        if (match && !seen.has(match[2])) {
          seen.add(match[2]);
          result.postLinks.push(match[2]);
        }
      });

      // Method 2: Check for Relay store data (Instagram's SPA data store)
      try {
        // Try various known Instagram data stores
        const stores = [
          (window as any).__relay_store__,
          (window as any).__RELAY_STORE__,
          (window as any).__initialData,
          (window as any)._sharedData,
          (window as any).__additionalDataLoaded,
        ];
        for (const store of stores) {
          if (store) {
            const storeStr = JSON.stringify(store).substring(0, 200);
            result.debugInfo += `Found store: ${storeStr}... `;
          }
        }
      } catch (e) {
        result.debugInfo += `Store error: ${(e as Error).message} `;
      }

      // Method 3: Check embedded JSON in script tags
      const scripts = document.querySelectorAll('script[type="application/json"]');
      scripts.forEach((script, i) => {
        const text = script.textContent || '';
        if (text.includes('liked') || text.includes('media_type') || text.includes('/p/')) {
          result.scriptData.push(`script[${i}]: ${text.substring(0, 200)}`);
        }
      });

      // Method 4: Check __NEXT_DATA__ (Next.js style)
      const nextDataEl = document.getElementById('__NEXT_DATA__');
      if (nextDataEl) {
        const text = nextDataEl.textContent || '';
        result.debugInfo += `__NEXT_DATA__ length: ${text.length} `;
        if (text.includes('liked') || text.includes('media_type')) {
          result.scriptData.push(`__NEXT_DATA__: ${text.substring(0, 200)}`);
        }
      }

      // Debug: count all elements and provide page structure info
      result.debugInfo += `Total links: ${links.length}, ` +
        `All anchors: ${document.querySelectorAll('a').length}, ` +
        `Images: ${document.querySelectorAll('img').length}, ` +
        `Body text length: ${document.body?.innerText?.length || 0}`;

      return result;
    });

    log.info({
      userId,
      postLinksCount: extractedData.postLinks.length,
      postLinks: extractedData.postLinks.slice(0, 10),
      relayItemsCount: extractedData.relayItems.length,
      scriptDataCount: extractedData.scriptData.length,
      scriptData: extractedData.scriptData.slice(0, 3),
      debugInfo: extractedData.debugInfo,
    }, 'Extracted data from likes page');

    // If no links found, try scrolling to trigger lazy loading
    if (extractedData.postLinks.length === 0) {
      log.info({ userId }, 'No post links found, scrolling to trigger content load');
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Re-extract after scroll
      const scrollLinks = await page.evaluate(() => {
        const links = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');
        const seen = new Set<string>();
        const result: string[] = [];
        links.forEach(link => {
          const href = link.getAttribute('href') || '';
          const match = href.match(/\/(p|reel)\/([A-Za-z0-9_-]+)/);
          if (match && !seen.has(match[2])) {
            seen.add(match[2]);
            result.push(match[2]);
          }
        });
        return result;
      });
      extractedData.postLinks = scrollLinks;
      log.info({ userId, postLinksCount: scrollLinks.length }, 'Post links after scroll');
    }

    await browser.close();

    if (extractedData.postLinks.length === 0) {
      log.warn({ userId }, 'No liked posts found on page');
      await prisma.connectedPlatform.update({
        where: { id: connectionId },
        data: { lastSyncAt: new Date(), lastSyncError: 'No liked posts found on page' },
      });
      return 0;
    }

    // DOM scraping only gives shortcodes — save all as INBOX,
    // the transcription worker will detect videos vs photos
    const shortcodes = extractedData.postLinks.slice(0, 20);
    log.info({ userId, itemCount: shortcodes.length }, 'Processing shortcodes');

    // Batch check existing content (use shortcode as externalId)
    const existingContent = await prisma.content.findMany({
      where: {
        userId,
        platform: Platform.INSTAGRAM,
        externalId: { in: shortcodes },
      },
      select: { externalId: true },
    });
    const existingIds = new Set(existingContent.map(c => c.externalId));

    // Insert oldest-liked first so most-recently-liked gets the latest createdAt
    const shortcodesReversed = [...shortcodes].reverse();

    for (const shortcode of shortcodesReversed) {
      if (existingIds.has(shortcode)) {
        continue;
      }

      const url = `https://www.instagram.com/reel/${shortcode}/`;

      await prisma.content.create({
        data: {
          userId,
          platform: Platform.INSTAGRAM,
          externalId: shortcode,
          url,
          title: 'Instagram Reel',
          capturedAt: new Date(),
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

    log.info({ userId, reelCount: newReelsCount }, 'New content synced');
    return newReelsCount;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    log.error({ err: error, userId }, 'Sync failed for user');
    await prisma.connectedPlatform.update({
      where: { id: connectionId },
      data: { lastSyncError: errorMsg },
    });
    return 0;
  }
}

/**
 * Main sync function - syncs all connected Instagram accounts
 */
export async function runInstagramSync(): Promise<void> {
  log.info('Starting sync');
  const startTime = Date.now();

  const connections = await prisma.connectedPlatform.findMany({
    where: { platform: Platform.INSTAGRAM },
    include: { user: true },
  });

  log.info({ userCount: connections.length }, 'Found users to sync');

  let totalNewReels = 0;
  let successCount = 0;
  let errorCount = 0;

  const TIMEOUT_MS = 90000; // longer timeout: page navigation + networkidle + scroll

  const results = await Promise.allSettled(
    connections.map(connection =>
      instagramLimiter(async () => {
        // Small staggered delay to avoid all requests hitting at once
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2000));
        return Promise.race([
          syncUserInstagram(connection.userId, connection.id),
          new Promise<number>((_, reject) =>
            setTimeout(() => reject(new Error(`Instagram sync timeout for user ${connection.userId}`)), TIMEOUT_MS)
          ),
        ]);
      })
    )
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      totalNewReels += result.value;
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
    totalNewReels
  }, 'Sync completed');
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
