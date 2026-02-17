// Instagram Sync Worker - Passive interception approach:
// 1. Playwright browser with Safari UA matching cookie origin (no Barcelona mismatch)
// 2. Navigate to Instagram, fetch liked feed from page context (same-origin, browser TLS)
// 3. Optional residential proxy to avoid datacenter IP detection
// → Consistent UA, real browser fingerprint, no suspicious API patterns
import { logger } from '../config/logger.js';
import { config } from '../config/env.js';
import { prisma } from '../config/database.js';
import { Platform, ContentStatus } from '@prisma/client';
import { instagramLimiter } from '../utils/rateLimiter.js';
import { shouldFilterContent } from '../services/contentFilter.js';

const log = logger.child({ job: 'instagram-sync' });

// Must match the exact UA used in ios/app/oauth/[platform].tsx WebView
// Cookies were created with this UA — Instagram checks consistency
const SAFARI_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

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
 * Uses passive interception: navigates to Instagram with Safari UA,
 * then fetches the liked feed from within the page context.
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

    // Build launch options with optional proxy
    const launchOptions: Record<string, any> = {
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--no-sandbox',
      ],
    };

    if (config.instagramProxy.url) {
      launchOptions.proxy = {
        server: config.instagramProxy.url,
        ...(config.instagramProxy.user && { username: config.instagramProxy.user }),
        ...(config.instagramProxy.pass && { password: config.instagramProxy.pass }),
      };
      log.info({ userId, proxy: config.instagramProxy.url }, 'Using residential proxy');
    }

    const browser = await chromium.launch(launchOptions);

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: SAFARI_UA,
      locale: 'fr-FR',
      timezoneId: 'Europe/Paris',
      isMobile: true,
      hasTouch: true,
      javaScriptEnabled: true,
    });

    // Remove webdriver flag for anti-detection
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      // @ts-ignore
      window.chrome = { runtime: {} };
    });

    await context.addCookies(playwrightCookies);

    const page = await context.newPage();

    // Set up response interceptor as fallback — captures any liked feed response
    // Using object wrapper to avoid TS narrowing issues with closure mutation
    const intercepted: { items: any[] | null } = { items: null };
    page.on('response', async (response) => {
      try {
        const url = response.url();
        if (url.includes('feed/liked') && response.status() === 200) {
          const contentType = response.headers()['content-type'] || '';
          if (contentType.includes('json')) {
            const data = await response.json();
            if (data.items && Array.isArray(data.items)) {
              intercepted.items = data.items;
              log.debug({ userId, count: data.items.length }, 'Intercepted liked feed response');
            }
          }
        }
      } catch { /* ignore parse errors on non-JSON responses */ }
    });

    // Anti-detection jitter: random 3-10s delay
    const jitterMs = 3000 + Math.random() * 7000;
    log.info({ userId, jitterMs: Math.round(jitterMs) }, 'Applying jitter before navigation');
    await new Promise(resolve => setTimeout(resolve, jitterMs));

    // Step 1: Navigate to Instagram homepage (establish session)
    log.info({ userId }, 'Navigating to Instagram homepage');
    const navResponse = await page.goto('https://www.instagram.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    if (!navResponse || navResponse.status() >= 400) {
      log.error({ userId, status: navResponse?.status() }, 'Failed to load Instagram homepage');
      await browser.close();
      await prisma.connectedPlatform.update({
        where: { id: connectionId },
        data: { lastSyncError: 'Failed to load Instagram' },
      });
      return 0;
    }

    // Small human-like delay after page load
    await page.waitForTimeout(2000 + Math.random() * 2000);

    // Step 2: Intercept the API call to inject Barcelona UA (required by /api/v1/)
    // while keeping the browser's real TLS fingerprint and cookie handling.
    // page.route() modifies headers on the outgoing request but the request itself
    // goes through the browser engine (better fingerprint than context.request).
    await page.route('**/api/v1/feed/liked/**', async (route) => {
      const headers = {
        ...route.request().headers(),
        'user-agent': 'Barcelona 289.0.0.77.109 Android',
        'x-ig-app-id': '1217981644879628',
      };
      await route.continue({ headers });
    });

    log.info({ userId }, 'Fetching liked feed via page.evaluate + route interception');

    const fetchResult = await page.evaluate(async () => {
      try {
        const csrfToken = document.cookie.match(/csrftoken=([^;]+)/)?.[1] || '';

        const response = await fetch('/api/v1/feed/liked/', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'X-CSRFToken': csrfToken,
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': '*/*',
          },
        });

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          return { ok: false, status: response.status, body: text.substring(0, 500) };
        }

        const data = await response.json();
        return { ok: true, status: response.status, data };
      } catch (e: any) {
        return { ok: false, status: 0, body: e.message || 'fetch error' };
      }
    });

    let allItems: any[] = [];

    if (fetchResult.ok && fetchResult.data?.items) {
      allItems = fetchResult.data.items;
      log.info({ userId, count: allItems.length }, 'Got items from page context fetch');
    } else {
      // Log what happened with the primary fetch
      log.warn({ userId, status: fetchResult.status, body: (fetchResult as any).body?.substring?.(0, 200) }, 'Page context fetch failed');

      // Check if we got data from the response interceptor (unlikely but possible)
      if (intercepted.items && intercepted.items.length > 0) {
        allItems = intercepted.items;
        log.info({ userId, count: allItems.length }, 'Using intercepted response data');
      }

      // Handle auth errors
      if (fetchResult.status === 401 || fetchResult.status === 403) {
        await browser.close();
        await prisma.connectedPlatform.update({
          where: { id: connectionId },
          data: { lastSyncError: 'Session expired. Please reconnect.' },
        });
        return 0;
      }

      // Handle rate limiting
      if (fetchResult.status === 429) {
        await browser.close();
        await prisma.connectedPlatform.update({
          where: { id: connectionId },
          data: { lastSyncError: 'Rate limited. Will retry later.' },
        });
        return 0;
      }

      // If still no data, record the error
      if (allItems.length === 0) {
        const errorMsg = `Fetch failed: status ${fetchResult.status}`;
        await browser.close();
        await prisma.connectedPlatform.update({
          where: { id: connectionId },
          data: { lastSyncError: errorMsg },
        });
        return 0;
      }
    }

    await browser.close();

    if (allItems.length === 0) {
      log.info({ userId }, 'No liked items returned');
      await prisma.connectedPlatform.update({
        where: { id: connectionId },
        data: { lastSyncAt: new Date(), lastSyncError: null },
      });
      return 0;
    }

    log.info({ userId, itemCount: allItems.length }, 'Got items from Instagram');

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

      // Skip entertainment content (memes, music clips, too short)
      const filterReason = shouldFilterContent(item.caption?.text || null, item.video_duration || null);
      if (filterReason) {
        log.debug({ externalId, filterReason }, 'Skipping filtered Instagram reel');
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

  const TIMEOUT_MS = 90000;

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
