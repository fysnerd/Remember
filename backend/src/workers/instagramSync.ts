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

interface LikedMediaItem {
  pk?: number;
  id?: string;
  code?: string;
  caption?: { text?: string };
  user?: { username?: string; full_name?: string };
  like_count?: number;
  comment_count?: number;
  video_duration?: number;
  image_versions2?: { candidates?: Array<{ url: string }> };
  taken_at?: number;
  media_type?: number;
  product_type?: string;
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

    // Match the UA from the iOS WebView that captured the cookies
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
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

    // Collect liked items from intercepted API responses
    const interceptedItems: LikedMediaItem[] = [];
    let sessionExpired = false;
    const apiUrlsSeen: string[] = []; // track all API/graphql URLs for debugging

    // Set up passive response interceptor BEFORE navigation
    page.on('response', async (response) => {
      const url = response.url();
      const status = response.status();

      // Detect session expiry from any API response
      if (status === 401 || status === 403) {
        sessionExpired = true;
        return;
      }

      const isLikedAPI = url.includes('/api/v1/feed/liked');
      const isGraphQL = url.includes('/graphql');

      // Track all API and GraphQL URLs for debugging
      if (isLikedAPI || isGraphQL) {
        apiUrlsSeen.push(`${status} ${url.substring(0, 120)}`);
      }

      if (!isLikedAPI && !isGraphQL) return;
      if (status !== 200) return;

      try {
        const text = await response.text();
        const data = JSON.parse(text);

        if (isLikedAPI && data.items) {
          log.info({ userId, count: data.items.length }, 'Intercepted REST liked items');
          interceptedItems.push(...data.items);
        }

        if (isGraphQL) {
          // Log all top-level GraphQL data keys for discovery
          const dataKeys = data?.data ? Object.keys(data.data) : [];
          if (dataKeys.length > 0) {
            log.info({ userId, dataKeys, url: url.substring(0, 80) }, 'GraphQL response keys');
          }

          // Try to find liked items in any key containing "liked"
          for (const key of dataKeys) {
            const node = data.data[key];
            if (!node) continue;

            // Check for edges pattern (paginated connection)
            if (node.edges && Array.isArray(node.edges)) {
              const items = node.edges.map((e: any) => e.node).filter(Boolean);
              // Check if this looks like media items (has media_type, pk, or code)
              const mediaItems = items.filter((item: any) =>
                item.media_type !== undefined || item.pk !== undefined || item.code !== undefined ||
                item.media?.media_type !== undefined || item.media?.pk !== undefined || item.media?.code !== undefined
              );
              if (mediaItems.length > 0) {
                log.info({ userId, key, count: mediaItems.length }, 'Found media items in GraphQL');
                // Unwrap .media if items are wrapped
                const unwrapped = mediaItems.map((item: any) => item.media || item);
                interceptedItems.push(...unwrapped);
              }
            }

            // Check for items array pattern (REST-style in GraphQL)
            if (node.items && Array.isArray(node.items)) {
              log.info({ userId, key, count: node.items.length }, 'Found items array in GraphQL');
              interceptedItems.push(...node.items);
            }
          }
        }
      } catch {
        // Response body not JSON or already consumed — ignore
      }
    });

    // Anti-detection jitter: random 3-10s delay before navigation
    const jitterMs = 3000 + Math.random() * 7000;
    log.info({ userId, jitterMs: Math.round(jitterMs) }, 'Applying jitter before navigation');
    await new Promise(resolve => setTimeout(resolve, jitterMs));

    // Navigate to the likes page — Instagram's frontend will make API calls naturally
    log.info({ userId }, 'Navigating to likes page');
    await page.goto('https://www.instagram.com/your_activity/interactions/likes/', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Log where we ended up
    const finalUrl = page.url();
    const pageTitle = await page.title().catch(() => 'unknown');
    log.info({ userId, finalUrl, pageTitle, apiUrlsSeen: apiUrlsSeen.length }, 'Page loaded');

    // Check for login redirect (session expired)
    if (finalUrl.includes('/accounts/login') || finalUrl.includes('/challenge/')) {
      log.warn({ userId, finalUrl }, 'Redirected to login — session expired');
      await browser.close();
      await prisma.connectedPlatform.update({
        where: { id: connectionId },
        data: { lastSyncError: 'Session expired. Please reconnect.' },
      });
      return 0;
    }

    if (sessionExpired) {
      log.warn({ userId }, 'Session expired (auth error from intercepted API)');
      await browser.close();
      await prisma.connectedPlatform.update({
        where: { id: connectionId },
        data: { lastSyncError: 'Session expired. Please reconnect.' },
      });
      return 0;
    }

    // Dismiss common Instagram popups (notifications, cookies, etc.)
    try {
      const dismissSelectors = [
        'button:has-text("Not Now")',
        'button:has-text("Pas maintenant")',
        'button:has-text("Decline optional cookies")',
        'button:has-text("Refuser les cookies optionnels")',
        'button:has-text("Allow all cookies")',
        'button:has-text("Autoriser tous les cookies")',
        'button:has-text("Accept All")',
        'button:has-text("Tout accepter")',
      ];
      for (const sel of dismissSelectors) {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          log.info({ userId, selector: sel }, 'Dismissing popup');
          await btn.click();
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch {
      // Popup dismissal is best-effort
    }

    // Wait for intercepted data — if nothing yet, scroll to trigger more API calls
    if (interceptedItems.length === 0) {
      log.info({ userId, apiUrlsSeen }, 'No items after first load, scrolling to trigger API');
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      // Wait up to 10s for API responses after scroll
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    // If still nothing, try waiting for any network activity
    if (interceptedItems.length === 0) {
      log.info({ userId }, 'Still no items, waiting 5s more for late responses');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Brief additional wait if we got items (allow any in-flight responses to complete)
    if (interceptedItems.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Log final state before closing
    log.info({ userId, interceptedCount: interceptedItems.length, apiUrlsSeen }, 'Closing browser');
    await browser.close();

    if (interceptedItems.length === 0) {
      log.warn({ userId }, 'No liked items intercepted from page');
      await prisma.connectedPlatform.update({
        where: { id: connectionId },
        data: { lastSyncAt: new Date(), lastSyncError: 'No items found on likes page' },
      });
      return 0;
    }

    const allItems = interceptedItems;
    log.info({ userId, itemCount: allItems.length }, 'Got items from API');

    // Filter: only videos (media_type 2 = video, product_type 'clips' = reel)
    const videos = allItems.filter((item: LikedMediaItem) =>
      item.media_type === 2 || item.product_type === 'clips'
    );
    log.info({
      userId,
      videoCount: videos.length,
      skippedCount: allItems.length - videos.length
    }, 'Filtered to videos');

    if (videos.length === 0) {
      await prisma.connectedPlatform.update({
        where: { id: connectionId },
        data: { lastSyncAt: new Date(), lastSyncError: null },
      });
      return 0;
    }

    // Limit to 20 most recent
    const items = videos.slice(0, 20);

    // Batch check existing content
    const externalIds = items
      .map((item: LikedMediaItem) => item.pk?.toString() || item.id?.toString() || item.code)
      .filter((id): id is string => !!id);

    const existingContent = await prisma.content.findMany({
      where: {
        userId,
        platform: Platform.INSTAGRAM,
        externalId: { in: externalIds },
      },
      select: { externalId: true },
    });
    const existingIds = new Set(existingContent.map(c => c.externalId));

    // Insert oldest-liked first so most-recently-liked gets the latest createdAt
    // (inbox sorts by createdAt desc → most recent like appears first)
    const itemsReversed = [...items].reverse();

    for (const item of itemsReversed) {
      const externalId = item.pk?.toString() || item.id?.toString() || item.code;
      if (!externalId) continue;

      if (existingIds.has(externalId)) {
        continue; // skip existing (can't break — reversed order)
      }

      const shortcode = item.code || externalId;
      const url = `https://www.instagram.com/p/${shortcode}/`;
      const authorUsername = item.user?.username || null;

      await prisma.content.create({
        data: {
          userId,
          platform: Platform.INSTAGRAM,
          externalId,
          url,
          title: item.caption?.text?.substring(0, 255) || 'Instagram Reel',
          description: item.caption?.text || null,
          thumbnailUrl: item.image_versions2?.candidates?.[0]?.url || null,
          duration: item.video_duration || null,
          authorUsername,
          channelName: authorUsername ? `@${authorUsername}` : null,
          likeCount: item.like_count || null,
          commentCount: item.comment_count || null,
          capturedAt: item.taken_at ? new Date(item.taken_at * 1000) : new Date(),
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
