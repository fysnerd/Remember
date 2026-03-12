// Instagram Sync Worker v3 - Full Instagram app fingerprint
// Changes from v2 (Barcelona):
// 1. Proper Instagram mobile UA (not Barcelona/Threads which was wrong app)
// 2. Full 25+ header set matching real Android app (based on instagrapi)
// 3. Stable device fingerprint per user connection (persisted in DB)
// 4. i.instagram.com endpoint (mobile API, not www)
// 5. gzip/deflate response handling
// 6. Fallback to instagrapi Python sidecar on challenge_required
import { logger } from '../config/logger.js';
import { config } from '../config/env.js';
import { prisma } from '../config/database.js';
import { Platform, ContentStatus } from '@prisma/client';
import { instagramLimiter } from '../utils/rateLimiter.js';
import { shouldFilterContent, cleanTitle } from '../services/contentFilter.js';
import https from 'node:https';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { promisify } from 'node:util';

const gunzipAsync = promisify(zlib.gunzip);
const inflateAsync = promisify(zlib.inflate);

const log = logger.child({ job: 'instagram-sync' });

// --- Instagram App Constants (aligned with instagrapi March 2026) ---
const IG_APP_VERSION = '385.0.0.47.74';
const IG_VERSION_CODE = '378906843';
const IG_APP_ID = '567067343352427'; // Instagram Android (NOT Barcelona/Threads)
const IG_API_HOST = 'i.instagram.com';
const IG_BLOKS_VERSION = 'e538d4591f238824118bfcb9528c8d005f2ea3becd947a3973c030ac971571a4';

// Realistic Android device profiles
const DEVICE_PROFILES = [
  { manufacturer: 'OnePlus', model: 'IN2025', device: 'OnePlus8Pro', cpu: 'qcom', dpi: '480dpi', resolution: '1080x2400' },
  { manufacturer: 'samsung', model: 'SM-G991B', device: 'o1s', cpu: 'exynos2100', dpi: '420dpi', resolution: '1080x2400' },
  { manufacturer: 'Google', model: 'Pixel 7', device: 'panther', cpu: 'tensor', dpi: '420dpi', resolution: '1080x2400' },
  { manufacturer: 'Xiaomi', model: '2201116SG', device: 'vili', cpu: 'qcom', dpi: '440dpi', resolution: '1080x2400' },
  { manufacturer: 'samsung', model: 'SM-S908B', device: 'b0s', cpu: 'exynos2200', dpi: '480dpi', resolution: '1440x3088' },
];

const COOKIE_KEYS = new Set(['sessionid', 'csrftoken', 'ds_user_id', 'mid', 'ig_did', 'ig_nrcb', 'rur', 'datr']);

// --- Types ---

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

interface DeviceFingerprint {
  device_id: string;
  phone_id: string;
  android_device_id: string;
  pigeon_session_id: string;
  profile_index: number;
}

interface ConnectionData {
  sessionid: string;
  csrftoken?: string;
  ds_user_id?: string;
  mid?: string;
  ig_did?: string;
  ig_nrcb?: string;
  rur?: string;
  datr?: string;
  _device?: DeviceFingerprint;
}

// --- Device fingerprint (persisted per connection for consistency) ---

function generateDeviceFingerprint(): DeviceFingerprint {
  return {
    device_id: crypto.randomUUID(),
    phone_id: crypto.randomUUID(),
    android_device_id: `android-${crypto.randomBytes(8).toString('hex')}`,
    pigeon_session_id: crypto.randomUUID(),
    profile_index: Math.floor(Math.random() * DEVICE_PROFILES.length),
  };
}

function getOrCreateDevice(data: ConnectionData): { device: DeviceFingerprint; isNew: boolean } {
  if (data._device) return { device: data._device, isNew: false };
  return { device: generateDeviceFingerprint(), isNew: true };
}

// --- Header builders ---

function buildUserAgent(device: DeviceFingerprint): string {
  const p = DEVICE_PROFILES[device.profile_index % DEVICE_PROFILES.length];
  return `Instagram ${IG_APP_VERSION} Android (26/8.0.0; ${p.dpi}; ${p.resolution}; ${p.manufacturer}; ${p.model}; ${p.device}; ${p.cpu}; en_US; ${IG_VERSION_CODE})`;
}

function buildCookieHeader(data: ConnectionData): string {
  return Object.entries(data)
    .filter(([k, v]) => COOKIE_KEYS.has(k) && v !== undefined && typeof v === 'string')
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function buildHeaders(data: ConnectionData, device: DeviceFingerprint): Record<string, string> {
  return {
    'User-Agent': buildUserAgent(device),
    'X-IG-App-ID': IG_APP_ID,
    'X-IG-Device-ID': device.device_id,
    'X-IG-Family-Device-ID': device.phone_id,
    'X-IG-Android-ID': device.android_device_id,
    'X-IG-App-Locale': 'en_US',
    'X-IG-Device-Locale': 'en_US',
    'X-IG-Mapped-Locale': 'en_US',
    'X-IG-Timezone-Offset': '3600', // CET (France)
    'X-IG-Connection-Type': 'WIFI',
    'X-IG-Capabilities': '3brTv10=',
    'X-IG-App-Startup-Country': 'FR',
    'X-IG-Bandwidth-Speed-KBPS': (2500 + Math.random() * 500).toFixed(3),
    'X-IG-Bandwidth-TotalBytes-B': String(Math.floor(5e6 + Math.random() * 85e6)),
    'X-IG-Bandwidth-TotalTime-MS': String(Math.floor(2000 + Math.random() * 7000)),
    'X-Bloks-Version-Id': IG_BLOKS_VERSION,
    'X-Bloks-Is-Layout-RTL': 'false',
    'X-Bloks-Is-Panorama-Enabled': 'true',
    'X-Pigeon-Session-Id': `UFS-${device.pigeon_session_id}-1`,
    'X-Pigeon-Rawclienttime': (Date.now() / 1000).toFixed(3),
    'X-FB-HTTP-Engine': 'Liger',
    'X-FB-Client-IP': 'True',
    'X-FB-Server-Cluster': 'True',
    'X-MID': data.mid || '',
    'X-IG-WWW-Claim': '0',
    'X-CSRFToken': data.csrftoken || '',
    'IG-INTENDED-USER-ID': data.ds_user_id || '0',
    'Cookie': buildCookieHeader(data),
    'Accept-Language': 'en-US',
    'Accept-Encoding': 'gzip, deflate',
    'Host': IG_API_HOST,
    'Connection': 'keep-alive',
  };
}

// --- HTTP helpers ---

async function decompressBody(raw: Buffer, encoding?: string): Promise<string> {
  if (encoding === 'gzip') return (await gunzipAsync(raw)).toString('utf-8');
  if (encoding === 'deflate') return (await inflateAsync(raw)).toString('utf-8');
  return raw.toString('utf-8');
}

interface FetchResult {
  statusCode: number;
  body: string;
  setCookieHeaders: string[];
}

async function fetchLikedFeed(data: ConnectionData, device: DeviceFingerprint): Promise<FetchResult> {
  const headers = buildHeaders(data, device);

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: IG_API_HOST,
      path: '/api/v1/feed/liked/',
      method: 'GET',
      headers,
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', async () => {
        try {
          const raw = Buffer.concat(chunks);
          const body = await decompressBody(raw, res.headers['content-encoding']);
          const setCookies = res.headers['set-cookie'] || [];
          resolve({
            statusCode: res.statusCode || 0,
            body,
            setCookieHeaders: Array.isArray(setCookies) ? setCookies : [setCookies],
          });
        } catch (err) {
          reject(err);
        }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Request timeout')); });
    req.end();
  });
}

// --- Instagrapi sidecar fallback ---

async function fetchViaInstagrapi(cookies: InstagramCookies): Promise<{ items: any[]; updatedCookies?: Record<string, string> } | null> {
  const sidecarUrl = config.instagrapi.url;
  if (!sidecarUrl) return null;

  try {
    log.info('Calling instagrapi sidecar');
    const response = await fetch(`${sidecarUrl}/instagram/liked-feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: cookies.sessionid,
        cookies: Object.fromEntries(
          Object.entries(cookies).filter(([k]) => COOKIE_KEYS.has(k))
        ),
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      log.warn({ status: response.status }, 'Instagrapi sidecar error');
      return null;
    }

    const result = await response.json() as any;
    if (result.challenge_required) {
      log.warn('Instagrapi sidecar also got challenge_required');
      return null;
    }

    return {
      items: result.items || [],
      updatedCookies: result.updated_cookies,
    };
  } catch (err) {
    log.warn({ err }, 'Instagrapi sidecar call failed');
    return null;
  }
}

// --- Cookie management ---

function mergeSetCookies(existing: ConnectionData, setCookieHeaders: string[]): ConnectionData {
  const updated = { ...existing };
  for (const header of setCookieHeaders) {
    const match = header.match(/^([^=]+)=([^;]*)/);
    if (match && COOKIE_KEYS.has(match[1])) {
      (updated as Record<string, any>)[match[1]] = match[2];
    }
  }
  return updated;
}

function extractCookies(data: ConnectionData): InstagramCookies {
  const cookies: Record<string, string> = {};
  for (const key of COOKIE_KEYS) {
    const val = (data as Record<string, any>)[key];
    if (val !== undefined) cookies[key] = val;
  }
  return cookies as unknown as InstagramCookies;
}

// --- Main sync per user ---

async function syncUserInstagram(userId: string, connectionId: string): Promise<number> {
  const connection = await prisma.connectedPlatform.findUnique({
    where: { id: connectionId },
  });

  if (!connection) {
    log.error({ connectionId }, 'Connection not found');
    return 0;
  }

  let data: ConnectionData;
  try {
    data = JSON.parse(connection.accessToken) as ConnectionData;
  } catch {
    log.error({ userId }, 'Invalid cookies for user');
    await prisma.connectedPlatform.update({
      where: { id: connectionId },
      data: { lastSyncError: 'Invalid cookies format' },
    });
    return 0;
  }

  if (!data.sessionid) {
    log.error({ userId }, 'Missing sessionid for user');
    await prisma.connectedPlatform.update({
      where: { id: connectionId },
      data: { lastSyncError: 'Missing sessionid cookie' },
    });
    return 0;
  }

  // Get or create device fingerprint (persisted for cross-sync consistency)
  const { device, isNew: deviceIsNew } = getOrCreateDevice(data);
  if (deviceIsNew) {
    data._device = device;
    await prisma.connectedPlatform.update({
      where: { id: connectionId },
      data: { accessToken: JSON.stringify(data) },
    });
    log.info({ userId, deviceId: device.device_id }, 'Generated new device fingerprint');
  }

  let newReelsCount = 0;

  try {
    // Anti-detection jitter: random 1-5s delay
    const jitterMs = 1000 + Math.random() * 4000;
    log.info({ userId, jitterMs: Math.round(jitterMs) }, 'Applying jitter');
    await new Promise(resolve => setTimeout(resolve, jitterMs));

    log.info({ userId }, 'Fetching liked feed');
    let allItems: any[] = [];
    let usedSidecar = false;

    // --- Primary: Direct fetch with full Instagram app headers ---
    const result = await fetchLikedFeed(data, device);

    // Refresh cookies from Set-Cookie response headers
    if (result.setCookieHeaders.length > 0) {
      const updatedData = mergeSetCookies(data, result.setCookieHeaders);
      const newJson = JSON.stringify(updatedData);
      if (newJson !== JSON.stringify(data)) {
        await prisma.connectedPlatform.update({
          where: { id: connectionId },
          data: { accessToken: newJson },
        });
        data = updatedData;
        log.debug({ userId }, 'Refreshed cookies from response');
      }
    }

    if (result.statusCode >= 200 && result.statusCode < 300) {
      const parsed = JSON.parse(result.body) as any;
      allItems = parsed.items || [];
      log.info({ userId, itemCount: allItems.length, moreAvailable: parsed.more_available }, 'Got items from Instagram');
    } else {
      // Direct fetch failed — try instagrapi sidecar on challenge/auth errors
      const isChallengeOrAuth =
        result.statusCode === 400 || result.statusCode === 401 || result.statusCode === 403 ||
        result.body.includes('challenge_required') ||
        result.body.includes('login_required') ||
        result.body.includes('checkpoint_required');

      log.warn({ userId, status: result.statusCode, body: result.body.substring(0, 300) }, 'Direct fetch failed');

      if (isChallengeOrAuth) {
        const sidecarResult = await fetchViaInstagrapi(extractCookies(data));
        if (sidecarResult && sidecarResult.items.length > 0) {
          allItems = sidecarResult.items;
          usedSidecar = true;
          log.info({ userId, itemCount: allItems.length }, 'Got items via instagrapi sidecar');

          if (sidecarResult.updatedCookies) {
            const merged: ConnectionData = { ...data, ...sidecarResult.updatedCookies } as ConnectionData;
            merged._device = device; // preserve device
            await prisma.connectedPlatform.update({
              where: { id: connectionId },
              data: { accessToken: JSON.stringify(merged) },
            });
          }
        }
      }

      // Both methods failed
      if (allItems.length === 0) {
        if (result.statusCode === 429) {
          await prisma.connectedPlatform.update({
            where: { id: connectionId },
            data: { lastSyncError: 'Rate limited. Will retry later.' },
          });
        } else if (isChallengeOrAuth) {
          await prisma.connectedPlatform.update({
            where: { id: connectionId },
            data: { lastSyncError: 'Session challenged. Please reconnect.' },
          });
        } else {
          await prisma.connectedPlatform.update({
            where: { id: connectionId },
            data: { lastSyncError: `Fetch failed: ${result.statusCode} - ${result.body.substring(0, 100)}` },
          });
        }
        return 0;
      }
    }

    if (allItems.length === 0) {
      log.info({ userId }, 'No liked items returned');
      await prisma.connectedPlatform.update({
        where: { id: connectionId },
        data: { lastSyncAt: new Date(), lastSyncError: null },
      });
      return 0;
    }

    // Filter: only videos (media_type 2 = video, product_type 'clips' = reel)
    const videos = allItems.filter((item: any) =>
      item.media_type === 2 || item.product_type === 'clips'
    );
    log.info({ userId, videoCount: videos.length, skippedCount: allItems.length - videos.length, usedSidecar }, 'Filtered to videos');

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
      where: { userId, platform: Platform.INSTAGRAM, externalId: { in: externalIds } },
      select: { externalId: true },
    });
    const existingIds = new Set(existingContent.map(c => c.externalId));

    // Insert oldest-liked first so most-recently-liked gets the latest createdAt
    const itemsReversed = [...items].reverse();

    for (const item of itemsReversed) {
      const externalId = item.pk?.toString() || item.id?.toString() || item.code;
      if (!externalId || existingIds.has(externalId)) continue;

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

  const TIMEOUT_MS = 45000; // Slightly higher to account for sidecar fallback

  const results = await Promise.allSettled(
    connections.map(connection =>
      instagramLimiter(async () => {
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
  log.info({ durationMs: duration, successCount, errorCount, totalNewReels }, 'Sync completed');
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
