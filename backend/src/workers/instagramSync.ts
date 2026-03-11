// Instagram Sync Worker v2 - Direct fetch approach:
// 1. No browser needed — direct Node.js fetch with Instagram app UA
// 2. /api/v1/feed/liked/ requires Instagram app UA (Barcelona), not browser UA
// 3. Session cookies from iOS WebView work fine with app UA
// 4. Cookie refresh from Set-Cookie response headers
// → Lightweight, fast, no Playwright overhead
import { logger } from '../config/logger.js';
import { prisma } from '../config/database.js';
import { Platform, ContentStatus } from '@prisma/client';
import { instagramLimiter } from '../utils/rateLimiter.js';
import { shouldFilterContent, cleanTitle } from '../services/contentFilter.js';

const log = logger.child({ job: 'instagram-sync' });

// Instagram private API requires an app UA — browser UAs get "useragent mismatch"
const INSTAGRAM_APP_UA = 'Barcelona 289.0.0.77.109 Android';
const INSTAGRAM_APP_ID = '1217981644879628'; // Android app ID

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
 * Build cookie header string from cookie object
 */
function buildCookieHeader(cookies: InstagramCookies): string {
  return Object.entries(cookies)
    .filter(([_, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

/**
 * Parse Set-Cookie headers and merge into existing cookies
 */
function mergeSetCookies(existing: InstagramCookies, headers: Headers): InstagramCookies {
  const updated = { ...existing };
  const knownKeys = new Set(['sessionid', 'csrftoken', 'ds_user_id', 'mid', 'ig_did', 'ig_nrcb', 'rur', 'datr']);

  // getSetCookie() returns an array of individual Set-Cookie values (Node 20+)
  const setCookies = headers.getSetCookie?.() || [];
  for (const header of setCookies) {
    const match = header.match(/^([^=]+)=([^;]*)/);
    if (match && knownKeys.has(match[1])) {
      (updated as Record<string, string>)[match[1]] = match[2];
    }
  }
  return updated;
}

/**
 * Fetch LIKED reels from Instagram for a specific user.
 * Uses direct Node.js fetch with Instagram app UA (Barcelona).
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
    // Anti-detection jitter: random 1-5s delay
    const jitterMs = 1000 + Math.random() * 4000;
    log.info({ userId, jitterMs: Math.round(jitterMs) }, 'Applying jitter');
    await new Promise(resolve => setTimeout(resolve, jitterMs));

    // Fetch liked feed directly — no browser needed
    log.info({ userId }, 'Fetching liked feed');

    const response = await fetch('https://www.instagram.com/api/v1/feed/liked/', {
      method: 'GET',
      headers: {
        'User-Agent': INSTAGRAM_APP_UA,
        'X-IG-App-ID': INSTAGRAM_APP_ID,
        'X-CSRFToken': cookies.csrftoken || '',
        'Cookie': buildCookieHeader(cookies),
        'Accept': '*/*',
      },
    });

    // Refresh cookies from Set-Cookie response headers
    const updatedCookies = mergeSetCookies(cookies, response.headers);
    const newJson = JSON.stringify(updatedCookies);
    if (newJson !== connection.accessToken) {
      await prisma.connectedPlatform.update({
        where: { id: connectionId },
        data: { accessToken: newJson },
      });
      cookies = updatedCookies;
      log.debug({ userId }, 'Refreshed Instagram cookies from response');
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      log.warn({ userId, status: response.status, body: body.substring(0, 300) }, 'Liked feed fetch failed');

      if (response.status === 401 || response.status === 403 ||
          body.includes('login_required') || body.includes('checkpoint_required')) {
        await prisma.connectedPlatform.update({
          where: { id: connectionId },
          data: { lastSyncError: 'Session expired. Please reconnect.' },
        });
        return 0;
      }

      if (response.status === 429) {
        await prisma.connectedPlatform.update({
          where: { id: connectionId },
          data: { lastSyncError: 'Rate limited. Will retry later.' },
        });
        return 0;
      }

      await prisma.connectedPlatform.update({
        where: { id: connectionId },
        data: { lastSyncError: `Fetch failed: ${response.status} - ${body.substring(0, 100)}` },
      });
      return 0;
    }

    const data = await response.json() as any;
    const allItems: any[] = data.items || [];

    if (allItems.length === 0) {
      log.info({ userId }, 'No liked items returned');
      await prisma.connectedPlatform.update({
        where: { id: connectionId },
        data: { lastSyncAt: new Date(), lastSyncError: null },
      });
      return 0;
    }

    log.info({ userId, itemCount: allItems.length, moreAvailable: data.more_available }, 'Got items from Instagram');

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
          title: cleanTitle(item.caption?.text || null, 'Instagram Reel'),
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

  const TIMEOUT_MS = 30000; // Much lower — no browser startup overhead

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
