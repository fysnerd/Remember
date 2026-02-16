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

    // MUST match the exact UA hardcoded in ios/app/oauth/[platform].tsx
    // The WebView creates cookies with this UA — Instagram checks it matches
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

    // Anti-detection jitter: random 3-10s delay before any request
    const jitterMs = 3000 + Math.random() * 7000;
    log.info({ userId, jitterMs: Math.round(jitterMs) }, 'Applying jitter before navigation');
    await new Promise(resolve => setTimeout(resolve, jitterMs));

    // Navigate to Instagram to establish session context
    log.info({ userId }, 'Navigating to Instagram');
    await page.goto('https://www.instagram.com/', {
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

    log.info({ userId, finalUrl }, 'Instagram loaded, calling liked API from browser');

    // Call the liked API from within the browser context.
    // fetch() from page.evaluate uses the browser's UA (matching the iOS WebView that created cookies)
    // and includes cookies automatically via credentials: 'include'.
    const apiResult = await page.evaluate(async (csrfToken: string) => {
      try {
        const resp = await fetch('https://www.instagram.com/api/v1/feed/liked/', {
          method: 'GET',
          headers: {
            'X-CSRFToken': csrfToken,
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': '*/*',
          },
          credentials: 'include',
        });

        const status = resp.status;
        if (!resp.ok) {
          const text = await resp.text().catch(() => '');
          return { error: `API error ${status}: ${text.substring(0, 300)}`, items: [], status };
        }

        const data = await resp.json();
        return { error: null, items: data.items || [], status };
      } catch (err: any) {
        return { error: err.message || 'Unknown fetch error', items: [], status: 0 };
      }
    }, cookies.csrftoken || '');

    await browser.close();

    log.info({ userId, status: apiResult.status, itemCount: apiResult.items.length, error: apiResult.error }, 'API result');

    if (apiResult.status === 401 || apiResult.status === 403) {
      log.warn({ userId, status: apiResult.status }, 'Session expired (auth error from API)');
      await prisma.connectedPlatform.update({
        where: { id: connectionId },
        data: { lastSyncError: 'Session expired. Please reconnect.' },
      });
      return 0;
    }

    if (apiResult.status === 429) {
      log.warn({ userId }, 'Rate limited by Instagram (429), skipping');
      await prisma.connectedPlatform.update({
        where: { id: connectionId },
        data: { lastSyncError: 'Rate limited. Will retry later.' },
      });
      return 0;
    }

    if (apiResult.error) {
      log.error({ userId, error: apiResult.error }, 'API error');
      await prisma.connectedPlatform.update({
        where: { id: connectionId },
        data: { lastSyncError: apiResult.error },
      });
      return 0;
    }

    if (apiResult.items.length === 0) {
      log.info({ userId }, 'No liked items returned from API');
      await prisma.connectedPlatform.update({
        where: { id: connectionId },
        data: { lastSyncAt: new Date(), lastSyncError: null },
      });
      return 0;
    }

    // Process items from the API response
    const allItems = apiResult.items;
    log.info({ userId, itemCount: allItems.length }, 'Got items from API');

    // Filter: only videos (media_type 2 = video, product_type 'clips' = reel)
    const videos = allItems.filter((item: any) =>
      item.media_type === 2 || item.product_type === 'clips'
    );
    log.info({ userId, videoCount: videos.length, skippedCount: allItems.length - videos.length }, 'Filtered to videos');

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
      .map((item: any) => item.pk?.toString() || item.id?.toString() || item.code)
      .filter((id: any): id is string => !!id);

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
    const itemsReversed = [...items].reverse();

    for (const item of itemsReversed) {
      const externalId = item.pk?.toString() || item.id?.toString() || item.code;
      if (!externalId) continue;

      if (existingIds.has(externalId)) {
        continue;
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
