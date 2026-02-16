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

    // Extract liked post data from the page
    const extractedData = await page.evaluate(() => {
      const result: {
        postLinks: string[];
        imgSrcs: string[];
        debugInfo: string;
        htmlSnippet: string;
      } = { postLinks: [], imgSrcs: [], debugInfo: '', htmlSnippet: '' };

      // Method 1: Extract post links from ANY attribute containing shortcode patterns
      const allElements = document.querySelectorAll('*');
      const seen = new Set<string>();

      allElements.forEach(el => {
        // Check href
        const href = el.getAttribute('href') || '';
        const hrefMatch = href.match(/\/(p|reel)\/([A-Za-z0-9_-]+)/);
        if (hrefMatch && !seen.has(hrefMatch[2])) {
          seen.add(hrefMatch[2]);
          result.postLinks.push(hrefMatch[2]);
        }

        // Check all data-* attributes for shortcodes or post IDs
        for (let i = 0; i < el.attributes.length; i++) {
          const attr = el.attributes[i];
          if (attr.name.startsWith('data-') || attr.name === 'aria-label') {
            const match = attr.value.match(/\/(p|reel)\/([A-Za-z0-9_-]+)/);
            if (match && !seen.has(match[2])) {
              seen.add(match[2]);
              result.postLinks.push(match[2]);
            }
          }
        }
      });

      // Method 2: Extract image CDN URLs (may contain post identifiers)
      const imgs = document.querySelectorAll('img');
      imgs.forEach(img => {
        const src = img.src || img.getAttribute('src') || '';
        if (src.includes('instagram') || src.includes('cdninstagram') || src.includes('fbcdn')) {
          result.imgSrcs.push(src.substring(0, 150));
        }
      });

      // Method 3: Search ALL script tags for embedded post data
      const scripts = document.querySelectorAll('script');
      scripts.forEach((script) => {
        const text = script.textContent || '';
        // Look for shortcode patterns in inline scripts
        const matches = text.matchAll(/\"code\":\"([A-Za-z0-9_-]{10,12})\"/g);
        for (const m of matches) {
          if (!seen.has(m[1])) {
            seen.add(m[1]);
            result.postLinks.push(m[1]);
          }
        }
        // Also try pk/id patterns
        const pkMatches = text.matchAll(/\"pk\":\"?(\d{15,20})\"?/g);
        for (const m of pkMatches) {
          if (!seen.has(m[1])) {
            seen.add(m[1]);
            result.postLinks.push(m[1]);
          }
        }
      });

      // Debug info
      result.debugInfo = `Anchors: ${document.querySelectorAll('a').length}, ` +
        `Images: ${imgs.length}, ` +
        `Divs: ${document.querySelectorAll('div').length}, ` +
        `Body length: ${document.body?.innerText?.length || 0}`;

      // Grab a snippet of the page HTML around images for structural analysis
      const mainContent = document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
      result.htmlSnippet = mainContent?.innerHTML?.substring(0, 1500) || '';

      return result;
    });

    log.info({
      userId,
      postLinksCount: extractedData.postLinks.length,
      postLinks: extractedData.postLinks.slice(0, 10),
      imgCount: extractedData.imgSrcs.length,
      imgSrcs: extractedData.imgSrcs.slice(0, 5),
      debugInfo: extractedData.debugInfo,
      htmlSnippet: extractedData.htmlSnippet.substring(0, 500),
    }, 'Extracted data from likes page');

    // If no links found, try scrolling to trigger lazy loading
    if (extractedData.postLinks.length === 0) {
      log.info({ userId }, 'No post links found, scrolling to trigger content load');
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Re-extract after scroll with the same thorough approach
      const scrollData = await page.evaluate(() => {
        const seen = new Set<string>();
        const postLinks: string[] = [];

        document.querySelectorAll('*').forEach(el => {
          const href = el.getAttribute('href') || '';
          const hrefMatch = href.match(/\/(p|reel)\/([A-Za-z0-9_-]+)/);
          if (hrefMatch && !seen.has(hrefMatch[2])) {
            seen.add(hrefMatch[2]);
            postLinks.push(hrefMatch[2]);
          }
          for (let i = 0; i < el.attributes.length; i++) {
            const attr = el.attributes[i];
            if (attr.name.startsWith('data-') || attr.name === 'aria-label') {
              const match = attr.value.match(/\/(p|reel)\/([A-Za-z0-9_-]+)/);
              if (match && !seen.has(match[2])) {
                seen.add(match[2]);
                postLinks.push(match[2]);
              }
            }
          }
        });

        // Search scripts again after scroll might have loaded new data
        document.querySelectorAll('script').forEach((script) => {
          const text = script.textContent || '';
          for (const m of text.matchAll(/\"code\":\"([A-Za-z0-9_-]{10,12})\"/g)) {
            if (!seen.has(m[1])) { seen.add(m[1]); postLinks.push(m[1]); }
          }
        });

        return postLinks;
      });
      extractedData.postLinks = scrollData;
      log.info({ userId, postLinksCount: scrollData.length }, 'Post links after scroll');
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
