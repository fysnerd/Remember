// Instagram Sync Worker - Hybrid approach:
// 1. Playwright browser for cookie auth + anti-detection
// 2. page.evaluate() to call Instagram private API from browser context
// This avoids UA mismatch and uses the browser's real cookies/session
import { logger } from '../config/logger.js';
import { prisma } from '../config/database.js';
import { Platform, ContentStatus } from '@prisma/client';

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

    // Navigate to i.instagram.com (mobile domain) to establish session
    log.debug({ userId }, 'Navigating to Instagram');
    await page.waitForTimeout(1000 + Math.random() * 2000);
    await page.goto('https://i.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000 + Math.random() * 2000);

    // Check if logged in
    if (page.url().includes('/accounts/login')) {
      log.error({ userId }, 'Cookies expired for user');
      await browser.close();
      await prisma.connectedPlatform.update({
        where: { id: connectionId },
        data: { lastSyncError: 'Session expired. Please reconnect.' },
      });
      return 0;
    }

    log.debug({ userId }, 'Session valid, fetching liked posts via Playwright API request');

    // Use context.request: sends cookies from browser context but with our own headers
    // This avoids the UA mismatch from page.evaluate's browser-controlled fetch
    const response = await context.request.get('https://i.instagram.com/api/v1/feed/liked/', {
      headers: {
        'User-Agent': 'Barcelona 289.0.0.77.109 Android',
        'X-IG-App-ID': '1217981644879628',
        'X-CSRFToken': cookies.csrftoken || '',
        'Accept': '*/*',
      },
    });

    const apiResult: { error: string | null; items: any[] } = { error: null, items: [] };

    if (!response.ok()) {
      const text = await response.text().catch(() => '');
      apiResult.error = `API error ${response.status()}: ${text.substring(0, 200)}`;
    } else {
      const data = await response.json();
      apiResult.items = data.items || [];
    }

    await browser.close();

    if (apiResult.error) {
      log.error({ userId, error: apiResult.error }, 'API error');
      await prisma.connectedPlatform.update({
        where: { id: connectionId },
        data: { lastSyncError: apiResult.error },
      });
      return 0;
    }

    const allItems = apiResult.items as LikedMediaItem[];
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

    // Limit to 15 most recent
    const items = videos.slice(0, 15);

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

    // Save new items (stop at first existing = incremental sync)
    for (const item of items) {
      const externalId = item.pk?.toString() || item.id?.toString() || item.code;
      if (!externalId) continue;

      if (existingIds.has(externalId)) {
        log.info({ userId, externalId }, 'Found existing - incremental sync complete');
        break;
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

  for (const connection of connections) {
    try {
      const newReels = await syncUserInstagram(connection.userId, connection.id);
      totalNewReels += newReels;
      successCount++;
    } catch (error) {
      log.error({ err: error, userId: connection.userId }, 'Sync failed for user');
      errorCount++;
    }
    // Human-like delay between users
    await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));
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
