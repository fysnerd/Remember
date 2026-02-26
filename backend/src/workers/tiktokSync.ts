// TikTok Sync Worker - Direct API approach via page.evaluate(fetch(...))
// Uses Playwright browser context for TikTok's auto-signing (X-Bogus),
// but eliminates all DOM interaction (no tab clicking, no scrolling).
// The browser's patched window.fetch automatically signs API requests.
import { logger } from '../config/logger.js';
import { prisma } from '../config/database.js';
import { Platform, ContentStatus } from '@prisma/client';
import { tiktokLimiter } from '../utils/rateLimiter.js';
import { shouldFilterContent, cleanTitle } from '../services/contentFilter.js';

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

interface FavoriteListResponse {
  itemList?: TikTokVideo[];
  hasMore?: boolean;
  cursor?: number | string;
  error?: string;
  statusCode?: number;
  status_code?: number;
}

/**
 * Extract secUid from TikTok profile page.
 * TikTok embeds user data in __UNIVERSAL_DATA_FOR_REHYDRATION__ script tag.
 */
async function extractSecUid(page: any): Promise<string | null> {
  return page.evaluate(() => {
    // Method 1: From __UNIVERSAL_DATA_FOR_REHYDRATION__ script tag
    const scriptEl = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
    if (scriptEl) {
      try {
        const data = JSON.parse(scriptEl.textContent || '{}');
        // Try multiple known paths
        const userDetail = data?.__DEFAULT_SCOPE__?.['webapp.user-detail'];
        if (userDetail?.userInfo?.user?.secUid) {
          return userDetail.userInfo.user.secUid;
        }
      } catch {}
    }

    // Method 2: From SIGI_STATE (older TikTok versions)
    const sigiEl = document.getElementById('SIGI_STATE');
    if (sigiEl) {
      try {
        const data = JSON.parse(sigiEl.textContent || '{}');
        const userModule = data?.UserModule?.users;
        if (userModule) {
          const firstUser = Object.values(userModule)[0] as any;
          if (firstUser?.secUid) return firstUser.secUid;
        }
      } catch {}
    }

    // Method 3: From any script tag containing secUid
    const scripts = Array.from(document.querySelectorAll('script'));
    for (let i = 0; i < scripts.length; i++) {
      const text = scripts[i].textContent || '';
      const match = text.match(/"secUid"\s*:\s*"([^"]+)"/);
      if (match) return match[1];
    }

    return null;
  });
}

/**
 * Fetch liked videos via page.evaluate(fetch(...)) — uses TikTok's own
 * patched fetch which auto-signs requests with X-Bogus.
 */
async function fetchLikedViaEvaluate(
  page: any,
  secUid: string,
  maxVideos: number = 20,
): Promise<TikTokVideo[]> {
  const allVideos: TikTokVideo[] = [];
  let cursor: number | string = 0;
  let hasMore = true;
  let pageNum = 0;
  const maxPages = 3; // Safety limit

  while (hasMore && allVideos.length < maxVideos && pageNum < maxPages) {
    pageNum++;
    log.debug({ secUid, cursor, pageNum, collected: allVideos.length }, 'Fetching page via evaluate');

    const result: FavoriteListResponse = await page.evaluate(
      async (params: { secUid: string; cursor: number | string; count: number }) => {
        // Build URL with all required TikTok params
        const baseParams = new URLSearchParams({
          secUid: params.secUid,
          count: String(params.count),
          cursor: String(params.cursor),
          // Standard TikTok web params
          aid: '1988',
          app_language: 'en',
          app_name: 'tiktok_web',
          browser_language: 'en-US',
          browser_name: 'Mozilla',
          browser_platform: 'Win32',
          browser_version: '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          channel: 'tiktok_web',
          cookie_enabled: 'true',
          device_platform: 'web_pc',
          os: 'windows',
          region: 'FR',
          screen_height: '1080',
          screen_width: '1920',
          webcast_language: 'en',
        });
        const url = `https://www.tiktok.com/api/favorite/item_list/?${baseParams.toString()}`;

        try {
          const resp = await fetch(url, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Accept': 'application/json, text/plain, */*',
              'Referer': 'https://www.tiktok.com/',
            },
          });
          if (!resp.ok) {
            const text = await resp.text().catch(() => 'no body');
            return { error: `HTTP ${resp.status}: ${text.substring(0, 200)}`, statusCode: resp.status, itemList: [], hasMore: false };
          }
          return await resp.json();
        } catch (e: any) {
          return { error: String(e), itemList: [], hasMore: false };
        }
      },
      { secUid, cursor, count: 35 },
    );

    if (result.error) {
      log.warn({ error: result.error, statusCode: result.statusCode }, 'Direct fetch failed, trying explicit sign');

      // Fallback: try with explicit byted_acrawler signing
      const signedResult: FavoriteListResponse = await page.evaluate(
        async (params: { secUid: string; cursor: number | string; count: number }) => {
          const baseParams = new URLSearchParams({
            secUid: params.secUid,
            count: String(params.count),
            cursor: String(params.cursor),
            aid: '1988',
            app_language: 'en',
            app_name: 'tiktok_web',
            browser_language: 'en-US',
            browser_name: 'Mozilla',
            browser_platform: 'Win32',
            browser_version: '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            channel: 'tiktok_web',
            cookie_enabled: 'true',
            device_platform: 'web_pc',
            os: 'windows',
            region: 'FR',
            screen_height: '1080',
            screen_width: '1920',
            webcast_language: 'en',
          });
          let url = `https://www.tiktok.com/api/favorite/item_list/?${baseParams.toString()}`;

          // Try explicit signing if byted_acrawler is available
          try {
            const w = window as any;
            if (w.byted_acrawler && w.byted_acrawler.frontierSign) {
              const signed = w.byted_acrawler.frontierSign(url);
              if (signed && signed['X-Bogus']) {
                url += `&X-Bogus=${signed['X-Bogus']}`;
              }
            }
          } catch {}

          try {
            const resp = await fetch(url, {
              method: 'GET',
              credentials: 'include',
              headers: {
                'Accept': 'application/json, text/plain, */*',
                'Referer': 'https://www.tiktok.com/',
              },
            });
            if (!resp.ok) {
              const text = await resp.text().catch(() => 'no body');
              return { error: `Signed HTTP ${resp.status}: ${text.substring(0, 200)}`, statusCode: resp.status, itemList: [], hasMore: false };
            }
            return await resp.json();
          } catch (e: any) {
            return { error: `Signed: ${String(e)}`, itemList: [], hasMore: false };
          }
        },
        { secUid, cursor, count: 35 },
      );

      if (signedResult.error) {
        log.warn({ error: signedResult.error }, 'Signed fetch also failed');
        break;
      }
      // Use signed result if it worked
      if (signedResult.itemList && signedResult.itemList.length > 0) {
        allVideos.push(...signedResult.itemList);
        hasMore = signedResult.hasMore === true;
        cursor = signedResult.cursor || 0;
        log.info({ pageNum, items: signedResult.itemList.length }, 'Signed fetch worked!');
        if (hasMore && allVideos.length < maxVideos) {
          await new Promise(r => setTimeout(r, 500));
        }
        continue;
      }
      break;
    }

    if (result.itemList && result.itemList.length > 0) {
      allVideos.push(...result.itemList);
      log.debug({ pageNum, newItems: result.itemList.length, total: allVideos.length }, 'Got items');
    } else {
      log.debug({ pageNum }, 'No items in response');
      break;
    }

    hasMore = result.hasMore === true;
    cursor = result.cursor || 0;

    // Small delay between pagination requests to avoid rate limiting
    if (hasMore && allVideos.length < maxVideos) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return allVideos;
}

/**
 * Fetch liked videos from TikTok for a specific user using direct API approach.
 * Falls back to scroll-based approach if API direct fails.
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

  try {
    const { chromium } = await import('playwright');

    // Convert cookies to Playwright format
    const playwrightCookies = Object.entries(cookies).map(([name, value]) => ({
      name,
      value: value as string,
      domain: '.tiktok.com',
      path: '/',
    }));

    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        locale: 'en-US',
      });

      await context.addCookies(playwrightCookies);
      const page = await context.newPage();

      // Navigate to profile — this loads TikTok's JS (including byted_acrawler for signing)
      log.debug({ userId }, 'Navigating to profile for JS loading + secUid extraction');
      await page.goto('https://www.tiktok.com/profile', { waitUntil: 'networkidle' });

      // Wait for TikTok's JS to fully initialize (signing infrastructure)
      await page.waitForTimeout(3000);

      // Check if we're logged in (should redirect to /@username)
      const currentUrl = page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('/signup')) {
        log.warn({ userId, currentUrl }, 'Session expired - redirected to login');
        await prisma.connectedPlatform.update({
          where: { id: connectionId },
          data: { lastSyncError: 'Session expired. Please reconnect TikTok.' },
        });
        return 0;
      }

      // Extract secUid from page
      const secUid = await extractSecUid(page);

      if (!secUid) {
        log.error({ userId, currentUrl }, 'Failed to extract secUid from profile page');
        // Fall back to scroll-based approach
        log.info({ userId }, 'Falling back to scroll-based approach');
        const fallbackCount = await syncUserTikTokScroll(page, userId, connectionId);
        return fallbackCount;
      }

      log.info({ userId, secUid: secUid.substring(0, 20) + '...' }, 'Extracted secUid, calling API directly');

      // Fetch liked videos via direct API call
      const likedVideos = await fetchLikedViaEvaluate(page, secUid, 20);

      if (likedVideos.length === 0) {
        log.warn({ userId }, 'No liked videos from API. Possible: likes private, cookies expired, or API change');
        // Try fallback
        log.info({ userId }, 'Trying scroll-based fallback');
        const fallbackCount = await syncUserTikTokScroll(page, userId, connectionId);
        if (fallbackCount > 0) return fallbackCount;
      }

      log.info({ userId, videoCount: likedVideos.length }, 'Found liked videos via direct API');

      // Deduplicate
      const seenIds = new Set<string>();
      const uniqueVideos = likedVideos.filter((video) => {
        if (seenIds.has(video.id)) return false;
        seenIds.add(video.id);
        return true;
      });

      // Save to DB — stop at first existing (incremental sync)
      for (const video of uniqueVideos) {
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
          log.info({ userId, videoId: video.id }, 'Found existing video - incremental sync complete');
          break;
        }

        // Skip entertainment content (memes, music clips, too short)
        const filterReason = shouldFilterContent(video.desc || null, video.video?.duration || null);
        if (filterReason) {
          log.debug({ videoId: video.id, filterReason }, 'Skipping filtered TikTok');
          continue;
        }

        const authorUsername = video.author.uniqueId;
        await prisma.content.create({
          data: {
            userId,
            platform: Platform.TIKTOK,
            externalId: video.id,
            url: `https://www.tiktok.com/@${authorUsername}/video/${video.id}`,
            title: cleanTitle(video.desc || null, `TikTok by @${authorUsername}`),
            description: video.desc || null,
            thumbnailUrl: video.video?.cover || null,
            duration: video.video?.duration || null,
            authorUsername,
            channelName: `@${authorUsername}`,
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

      log.info({ userId, videoCount: newVideosCount }, 'New content synced via direct API');
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
 * FALLBACK: Scroll-based approach (original method).
 * Used when secUid extraction or direct API call fails.
 * Expects a page already navigated to the profile.
 */
async function syncUserTikTokScroll(page: any, userId: string, connectionId: string): Promise<number> {
  log.info({ userId }, 'Using scroll-based fallback');

  const likedVideos: TikTokVideo[] = [];
  let foundExisting = false;

  // Intercept API responses
  page.on('response', async (response: any) => {
    const url = response.url();
    if (url.includes('favorite/item_list') || url.includes('api/favorite/')) {
      try {
        const data = await response.json();
        if (data.itemList && Array.isArray(data.itemList)) {
          likedVideos.push(...data.itemList);
        }
      } catch {}
    }
  });

  // Try clicking "Liked" tab
  let clickedLikedTab = false;

  // Method 1: English text
  try {
    const likedByText = page.getByText('Liked', { exact: true });
    if (await likedByText.count() > 0) {
      await likedByText.first().click();
      clickedLikedTab = true;
    }
  } catch {}

  // Method 2: French text
  if (!clickedLikedTab) {
    try {
      const aiméByText = page.getByText('A aimé', { exact: true });
      if (await aiméByText.count() > 0) {
        await aiméByText.first().click();
        clickedLikedTab = true;
      }
    } catch {}
  }

  // Method 3: Role-based
  if (!clickedLikedTab) {
    try {
      const tabs = page.getByRole('tab');
      const count = await tabs.count();
      for (let i = 0; i < count; i++) {
        const tabText = await tabs.nth(i).textContent();
        if (tabText?.toLowerCase().includes('liked') || tabText?.toLowerCase().includes('aimé')) {
          await tabs.nth(i).click();
          clickedLikedTab = true;
          break;
        }
      }
    } catch {}
  }

  // Method 4: data-e2e
  if (!clickedLikedTab) {
    try {
      const likedTab = await page.$('[data-e2e="liked-tab"], [data-e2e*="liked"]');
      if (likedTab) {
        await likedTab.click();
        clickedLikedTab = true;
      }
    } catch {}
  }

  if (clickedLikedTab) {
    await page.waitForTimeout(4000);
  }

  // Scroll to load videos
  const maxScrolls = 10;
  const maxVideos = 20;
  for (let i = 0; i < maxScrolls && !foundExisting && likedVideos.length < maxVideos; i++) {
    const prevCount = likedVideos.length;
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(1500);

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
        foundExisting = true;
        break;
      }
    }

    if (foundExisting) break;
    if (i > 3 && likedVideos.length === prevCount) break;
  }

  log.info({ userId, videoCount: likedVideos.length, method: 'scroll-fallback' }, 'Found liked videos');

  // Deduplicate and save
  const seenIds = new Set<string>();
  const uniqueVideos = likedVideos.filter((video) => {
    if (seenIds.has(video.id)) return false;
    seenIds.add(video.id);
    return true;
  });

  let newVideosCount = 0;
  for (const video of uniqueVideos) {
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

    if (existing) break;

    // Skip entertainment content (memes, music clips, too short)
    const filterReason = shouldFilterContent(video.desc || null, video.video?.duration || null);
    if (filterReason) {
      log.debug({ videoId: video.id, filterReason }, 'Skipping filtered TikTok');
      continue;
    }

    const authorUsername = video.author.uniqueId;
    await prisma.content.create({
      data: {
        userId,
        platform: Platform.TIKTOK,
        externalId: video.id,
        url: `https://www.tiktok.com/@${authorUsername}/video/${video.id}`,
        title: cleanTitle(video.desc || null, `TikTok by @${authorUsername}`),
        description: video.desc || null,
        thumbnailUrl: video.video?.cover || null,
        duration: video.video?.duration || null,
        authorUsername,
        channelName: `@${authorUsername}`,
        viewCount: video.stats?.playCount || null,
        capturedAt: new Date(video.createTime * 1000),
        status: ContentStatus.INBOX,
      },
    });
    newVideosCount++;
  }

  if (newVideosCount > 0) {
    await prisma.connectedPlatform.update({
      where: { id: connectionId },
      data: { lastSyncAt: new Date(), lastSyncError: null },
    });
  }

  return newVideosCount;
}

/**
 * Main sync function - syncs all connected TikTok accounts
 */
export async function runTikTokSync(): Promise<void> {
  log.info('Starting sync');
  const startTime = Date.now();

  const connections = await prisma.connectedPlatform.findMany({
    where: { platform: Platform.TIKTOK },
    include: { user: true },
  });

  log.info({ userCount: connections.length }, 'Found users to sync');

  let totalNewVideos = 0;
  let successCount = 0;
  let errorCount = 0;

  const TIMEOUT_MS = 45000; // 45s timeout (API ~15s, fallback scroll needs more)

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
