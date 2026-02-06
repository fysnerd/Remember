// Instagram Sync Worker - Fetches LIKED reels using Instagram private API
// Uses stored session cookies with fetch() (no Playwright needed)
// STOPS when it finds content already in DB (incremental sync)
import { prisma } from '../config/database.js';
import { Platform, ContentStatus } from '@prisma/client';

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

interface InstagramMediaItem {
  pk?: number;
  id?: string;
  code?: string;
  caption?: { text?: string };
  user?: { username?: string; full_name?: string };
  like_count?: number;
  comment_count?: number;
  video_duration?: number;
  image_versions2?: { candidates?: Array<{ url: string; width?: number; height?: number }> };
  taken_at?: number;
  media_type?: number;
  product_type?: string;
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
 * Build cookie header string from cookies object
 */
function buildCookieHeader(cookies: InstagramCookies): string {
  return Object.entries(cookies)
    .filter(([_, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

/**
 * Build headers for Instagram private API requests
 */
function buildHeaders(cookies: InstagramCookies): Record<string, string> {
  return {
    'Cookie': buildCookieHeader(cookies),
    'X-IG-App-ID': '936619743392459',
    'X-CSRFToken': cookies.csrftoken || '',
    'X-IG-WWW-Claim': '0',
    'X-Requested-With': 'XMLHttpRequest',
    // Must use desktop browser UA to match X-IG-App-ID (web app ID)
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'fr-FR,fr;q=0.9',
    'Referer': 'https://www.instagram.com/',
    'Origin': 'https://www.instagram.com',
  };
}

/**
 * Fetch liked posts from Instagram private API
 */
async function fetchLikedPosts(cookies: InstagramCookies, maxId?: string): Promise<{
  items: InstagramMediaItem[];
  nextMaxId?: string;
  status: string;
}> {
  const url = maxId
    ? `https://www.instagram.com/api/v1/feed/liked/?max_id=${maxId}`
    : 'https://www.instagram.com/api/v1/feed/liked/';

  const response = await fetch(url, {
    headers: buildHeaders(cookies),
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error('SESSION_EXPIRED');
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Instagram API error ${response.status}: ${text.substring(0, 200)}`);
  }

  const data = await response.json() as any;
  return {
    items: data.items || [],
    nextMaxId: data.next_max_id,
    status: data.status || 'unknown',
  };
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

  try {
    console.log(`[Instagram Sync] Fetching liked posts via API for user ${userId}...`);

    const result = await fetchLikedPosts(cookies);

    if (!result.items || result.items.length === 0) {
      console.log(`[Instagram Sync] No liked posts returned for user ${userId}`);
      await prisma.connectedPlatform.update({
        where: { id: connectionId },
        data: { lastSyncAt: new Date(), lastSyncError: null },
      });
      return 0;
    }

    console.log(`[Instagram Sync] Got ${result.items.length} items from API`);

    // Limit to 15 most recent
    const items = result.items.slice(0, 15);

    // Deduplicate
    const seenIds = new Set<string>();
    const uniqueItems = items.filter((item) => {
      const id = item.pk?.toString() || item.id?.toString() || item.code;
      if (!id || seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });

    // Save to DB (stop when we find existing content = incremental sync)
    for (const item of uniqueItems) {
      const externalId = item.pk?.toString() || item.id?.toString() || item.code;
      if (!externalId) continue;

      const shortcode = item.code || externalId;
      const url = `https://www.instagram.com/p/${shortcode}/`;
      const authorUsername = item.user?.username || null;

      // Check if already exists - if yes, stop (incremental sync)
      const exists = await contentExists(userId, externalId);
      if (exists) {
        console.log(`[Instagram Sync] Found existing reel ${shortcode} - stopping (incremental sync complete)`);
        break;
      }

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

    console.log(`[Instagram Sync] User ${userId}: synced ${newReelsCount} new reels`);
    return newReelsCount;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    if (errorMsg === 'SESSION_EXPIRED') {
      console.warn(`[Instagram Sync] Session expired for user ${userId}`);
      await prisma.connectedPlatform.update({
        where: { id: connectionId },
        data: { lastSyncError: 'Session expired. Please reconnect Instagram.' },
      });
    } else {
      console.error(`[Instagram Sync] Error for user ${userId}:`, error);
      await prisma.connectedPlatform.update({
        where: { id: connectionId },
        data: { lastSyncError: errorMsg },
      });
    }
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
    // Small delay between users to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
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
