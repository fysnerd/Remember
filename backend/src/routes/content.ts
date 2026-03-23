import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { ContentStatus, Platform, Prisma } from '@prisma/client';
import { processContentTranscript } from '../services/transcription.js';
import { processPodcastTranscript } from '../services/podcastTranscription.js';
import { processTikTokTranscript } from '../services/tiktokTranscription.js';
import { processInstagramTranscript } from '../services/instagramTranscription.js';
import { processContentQuiz, regenerateQuiz, generateMemoFromTranscript } from '../services/quizGeneration.js';
import { autoTagContent } from '../services/tagging.js';
import { classifyContentForUser, evolveThemesForUser } from '../services/themeClassification.js';
import { syncUserYouTube } from '../workers/youtubeSync.js';
import { syncUserSpotify } from '../workers/spotifySync.js';
import { syncTikTokForUser } from '../workers/tiktokSync.js';
import { syncInstagramForUser } from '../workers/instagramSync.js';
import { runUserPipeline } from '../services/pipeline.js';
import { generateText, generateEmbedding } from '../services/llm.js';
import { shouldFilterContent, cleanTitle } from '../services/contentFilter.js';
import { logger } from '../config/logger.js';

const log = logger.child({ route: 'content' });

// Helper to safely extract string param (handles string | string[] | undefined)
function asString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

/** Build self-referential context string for memo/synopsis generation */
function buildCreatorContextForMemo(
  platform: string,
  channelName: string | null,
  authorUsername: string | null,
  showName: string | null,
  capturedAt: Date | null
): string {
  const platformRef =
    platform === 'TIKTOK' ? 'video TikTok' :
    platform === 'INSTAGRAM' ? 'reel Instagram' :
    platform === 'YOUTUBE' ? 'video YouTube' :
    'podcast Spotify';

  const creatorName = channelName || authorUsername || showName || null;
  const creatorRef = creatorName ? ` de ${creatorName}` : '';

  const temporalRef = capturedAt
    ? ` (contenu que tu as ${platform === 'SPOTIFY' ? 'ecoute' : 'regarde'} le ${capturedAt.toLocaleDateString('fr-FR')})`
    : '';

  return `cette ${platformRef}${creatorRef}${temporalRef}`;
}

export const contentRouter = Router();

// All content routes require authentication
contentRouter.use(authenticateToken);

// ============================================================================
// Refresh / Sync Endpoint (User-accessible)
// ============================================================================

// POST /api/content/refresh - Trigger sync for all connected platforms
// Fire-and-forget: returns 202 immediately, syncs in background
// Cooldown: skips platforms synced less than 5 minutes ago
contentRouter.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const COOLDOWN_MS = 0; // No cooldown for YouTube, Spotify, TikTok — instant sync
    const IG_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes (Instagram — on-demand only, no cron)
    const now = new Date();

    // Get all connected platforms for this user
    const connections = await prisma.connectedPlatform.findMany({
      where: { userId },
    });

    if (connections.length === 0) {
      return res.json({
        message: 'No platforms connected',
        platforms: [],
        syncing: false,
      });
    }

    // Filter out platforms that were synced recently (cooldown)
    const eligibleConnections = connections.filter((c) => {
      if (!c.lastSyncAt) return true; // Never synced → eligible
      const cooldown = c.platform === Platform.INSTAGRAM ? IG_COOLDOWN_MS : COOLDOWN_MS;
      return now.getTime() - c.lastSyncAt.getTime() >= cooldown;
    });

    const skippedPlatforms = connections
      .filter((c) => !eligibleConnections.includes(c))
      .map((c) => c.platform.toLowerCase());

    if (eligibleConnections.length === 0) {
      return res.json({
        message: 'All platforms synced recently. Try again in a few minutes.',
        platforms: [],
        skipped: skippedPlatforms,
        syncing: false,
      });
    }

    // Track which platforms will be synced
    const syncingPlatforms: string[] = [];

    for (const connection of eligibleConnections) {
      if (connection.platform === Platform.YOUTUBE) {
        syncingPlatforms.push('youtube');
      } else if (connection.platform === Platform.SPOTIFY) {
        syncingPlatforms.push('spotify');
      } else if (connection.platform === Platform.TIKTOK) {
        syncingPlatforms.push('tiktok');
      } else if (connection.platform === Platform.INSTAGRAM) {
        syncingPlatforms.push('instagram');
      }
    }

    log.info({ userId, platforms: syncingPlatforms, skipped: skippedPlatforms }, 'Background refresh started');

    // Return 202 immediately — sync runs in background
    res.status(202).json({
      message: 'Sync started',
      syncing: syncingPlatforms,
      skipped: skippedPlatforms,
    });

    // Fire-and-forget: run syncs in background
    const syncPromises: Promise<void>[] = [];

    for (const connection of eligibleConnections) {
      if (connection.platform === Platform.YOUTUBE) {
        syncPromises.push(
          syncUserYouTube(userId, connection.id)
            .then((n) => { log.info({ userId, platform: 'youtube', newItems: n }, 'Background sync done'); })
            .catch((err) => { log.error({ err, userId, platform: 'youtube' }, 'Background sync failed'); })
        );
      } else if (connection.platform === Platform.SPOTIFY) {
        syncPromises.push(
          syncUserSpotify(userId, connection.id)
            .then((n) => { log.info({ userId, platform: 'spotify', newItems: n }, 'Background sync done'); })
            .catch((err) => { log.error({ err, userId, platform: 'spotify' }, 'Background sync failed'); })
        );
      } else if (connection.platform === Platform.TIKTOK) {
        syncPromises.push(
          syncTikTokForUser(userId)
            .then((n) => { log.info({ userId, platform: 'tiktok', newItems: n }, 'Background sync done'); })
            .catch((err) => { log.error({ err, userId, platform: 'tiktok' }, 'Background sync failed'); })
        );
      } else if (connection.platform === Platform.INSTAGRAM) {
        syncPromises.push(
          syncInstagramForUser(userId)
            .then((n) => { log.info({ userId, platform: 'instagram', newItems: n }, 'Background sync done'); })
            .catch((err) => { log.error({ err, userId, platform: 'instagram' }, 'Background sync failed'); })
        );
      }
    }

    // Don't await — this runs after response is sent
    Promise.allSettled(syncPromises).then((results) => {
      const fulfilled = results.filter((r) => r.status === 'fulfilled').length;
      const rejected = results.filter((r) => r.status === 'rejected').length;
      log.info({ userId, fulfilled, rejected, platforms: syncingPlatforms }, 'Background refresh completed');

      // Chain pipeline: transcription → quiz → tags (runs in background)
      // Always run — even if sync found 0 new items, there may be
      // content from previous syncs still waiting for transcription/quiz
      runUserPipeline(userId).catch((err) => {
        log.error({ err, userId }, 'User pipeline failed after refresh');
      });
    });
  } catch (error) {
    return next(error);
  }
});

// ============================================================================
// Instagram On-Device Sync — Import items extracted on user's device
// ============================================================================

/**
 * POST /api/content/import-instagram-items
 *
 * Receives Instagram liked feed items that were extracted on-device via WebView.
 * The mobile app intercepts Instagram's feed/liked API response and sends
 * the raw items here. This avoids making Instagram API calls from the VPS
 * (which triggers "suspicious login" warnings).
 *
 * Body: { items: InstagramItem[] }
 * Returns: { newItems: number }
 */
contentRouter.post('/import-instagram-items', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.json({ newItems: 0, message: 'No items provided' });
    }

    log.info({ userId, itemCount: items.length }, 'Importing Instagram items from on-device sync');

    // Filter: only videos (media_type 2 = video, product_type 'clips' = reel)
    const videos = items.filter((item: any) =>
      item.media_type === 2 || item.product_type === 'clips'
    );

    if (videos.length === 0) {
      return res.json({ newItems: 0, message: 'No video/reel items found' });
    }

    // Limit to 20 most recent
    const toProcess = videos.slice(0, 20);

    // Batch check existing content to avoid duplicates
    const externalIds = toProcess
      .map((item: any) => item.pk?.toString() || item.id?.toString() || item.code)
      .filter((id: any): id is string => !!id);

    const existingContent = await prisma.content.findMany({
      where: { userId, platform: Platform.INSTAGRAM, externalId: { in: externalIds } },
      select: { externalId: true },
    });
    const existingIds = new Set(existingContent.map(c => c.externalId));

    // Insert oldest-liked first so most-recently-liked gets the latest createdAt
    const itemsReversed = [...toProcess].reverse();
    let newItems = 0;

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
      newItems++;
    }

    // Update lastSyncAt on the connection (if it exists)
    await prisma.connectedPlatform.updateMany({
      where: { userId, platform: Platform.INSTAGRAM },
      data: { lastSyncAt: new Date(), lastSyncError: null },
    });

    log.info({ userId, newItems, totalItems: items.length, videos: videos.length }, 'On-device Instagram import done');

    return res.json({ newItems });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/content/import-instagram-shortcodes
 *
 * Receives shortcodes extracted on-device from Instagram's Bloks responses.
 * Creates Content records with URLs — the transcription pipeline will
 * handle downloading and processing.
 *
 * Body: { shortcodes: string[], items?: { code, pk, thumbnailUrl }[] }
 * Returns: { newItems: number }
 */
contentRouter.post('/import-instagram-shortcodes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { shortcodes, items: richItems } = req.body;

    if (!Array.isArray(shortcodes) || shortcodes.length === 0) {
      res.json({ newItems: 0 });
      return;
    }

    log.info({ userId, count: shortcodes.length }, 'Importing Instagram shortcodes from on-device sync');

    // Build lookup for rich items (code → { thumbnailUrl, pk })
    const itemLookup: Record<string, { thumbnailUrl?: string; pk?: string }> = {};
    if (Array.isArray(richItems)) {
      for (const item of richItems) {
        if (item.code) itemLookup[item.code] = item;
      }
    }

    // Deduplicate + filter invalid shortcodes (valid IG shortcodes are 6-14 chars)
    const uniqueCodes = [...new Set(shortcodes as string[])]
      .filter(code => code.length >= 6 && code.length <= 14)
      .slice(0, 50);

    // Check existing content by externalId (shortcode)
    const existingContent = await prisma.content.findMany({
      where: { userId, platform: Platform.INSTAGRAM, externalId: { in: uniqueCodes } },
      select: { externalId: true },
    });
    const existingIds = new Set(existingContent.map(c => c.externalId));

    let newItems = 0;

    for (const code of uniqueCodes) {
      if (existingIds.has(code)) continue;

      const url = `https://www.instagram.com/reel/${code}/`;
      const rich = itemLookup[code];

      await prisma.content.create({
        data: {
          userId,
          platform: Platform.INSTAGRAM,
          externalId: code,
          url,
          title: 'Instagram Reel',
          thumbnailUrl: rich?.thumbnailUrl || null,
          capturedAt: new Date(),
          status: ContentStatus.INBOX,
        },
      });
      newItems++;
    }

    // Update lastSyncAt
    await prisma.connectedPlatform.updateMany({
      where: { userId, platform: Platform.INSTAGRAM },
      data: { lastSyncAt: new Date(), lastSyncError: null },
    });

    log.info({ userId, newItems, totalCodes: uniqueCodes.length }, 'On-device Instagram shortcodes import done');
    res.json({ newItems });

    // Background: enrich new items with yt-dlp metadata (title, thumbnail, author, duration)
    if (newItems > 0) {
      enrichInstagramItems(userId).catch((err) => {
        log.error({ err, userId }, 'Background Instagram enrichment failed');
      });
    }
  } catch (error) {
    return next(error);
  }
});

/**
 * Background enrichment: fetch metadata for Instagram items that only have "Instagram Reel" as title.
 * Uses yt-dlp --dump-json (fast, no download) with stored cookies.
 */
async function enrichInstagramItems(userId: string): Promise<void> {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const { writeFile, unlink } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const path = await import('node:path');
  const execFileAsync = promisify(execFile);

  const items = await prisma.content.findMany({
    where: { userId, platform: Platform.INSTAGRAM, title: 'Instagram Reel' },
    select: { id: true, url: true, externalId: true },
    take: 20,
    orderBy: { createdAt: 'desc' },
  });

  if (items.length === 0) return;
  log.info({ userId, count: items.length }, 'Enriching Instagram items with yt-dlp');

  // Build cookies file from stored connection
  let cookiesPath: string | null = null;
  try {
    const connection = await prisma.connectedPlatform.findUnique({
      where: { userId_platform: { userId, platform: Platform.INSTAGRAM } },
      select: { accessToken: true },
    });
    if (connection?.accessToken) {
      const cookies = JSON.parse(connection.accessToken);
      const lines = ['# Netscape HTTP Cookie File'];
      for (const [name, value] of Object.entries(cookies)) {
        if (name.startsWith('_') || typeof value !== 'string') continue;
        lines.push(`.instagram.com\tTRUE\t/\tTRUE\t0\t${name}\t${value}`);
      }
      cookiesPath = path.join(tmpdir(), `ig-enrich-${userId}.txt`);
      await writeFile(cookiesPath, lines.join('\n'));
    }
  } catch {}

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    // Skip invalid shortcodes (too long = bad ig_cache_key decode)
    if (item.externalId && item.externalId.length > 15) {
      log.debug({ contentId: item.id, code: item.externalId }, 'Skipping invalid shortcode');
      continue;
    }
    // Rate-limit: wait 2s between each request to avoid Instagram throttling
    if (i > 0) await new Promise(r => setTimeout(r, 2000));
    try {
      const args = ['--no-warnings', '--dump-json', '--no-download'];
      if (cookiesPath) args.push('--cookies', cookiesPath);
      args.push(item.url);

      const { stdout } = await execFileAsync('yt-dlp', args, { timeout: 15000 });
      const meta = JSON.parse(stdout);

      const title = meta.title || meta.description?.substring(0, 100) || 'Instagram Reel';
      const update: any = {
        title: title.split('\n')[0].substring(0, 200), // First line, max 200 chars
      };

      if (meta.thumbnail) update.thumbnailUrl = meta.thumbnail;
      if (meta.duration) update.duration = Math.round(meta.duration);
      if (meta.uploader || meta.channel) {
        update.authorUsername = meta.uploader || meta.channel;
        update.channelName = `@${update.authorUsername}`;
      }

      await prisma.content.update({ where: { id: item.id }, data: update });
      log.debug({ contentId: item.id, title: update.title }, 'Enriched Instagram item');
    } catch (err) {
      log.debug({ contentId: item.id, err }, 'Could not enrich Instagram item');
    }
  }

  // Cleanup
  if (cookiesPath) {
    try { await unlink(cookiesPath); } catch {}
  }

  log.info({ userId, count: items.length }, 'Instagram enrichment done');
}

// GET /api/content - List user's content with search & filters
contentRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      platform,
      status,
      page = '1',
      limit = '20',
      search,
      tags,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const where: Prisma.ContentWhereInput = {
      userId: req.user!.id,
    };

    // Platform filter (supports comma-separated: YOUTUBE,SPOTIFY)
    if (platform && typeof platform === 'string') {
      const platforms = platform.split(',').map(p => p.trim()).filter(p => ['YOUTUBE', 'SPOTIFY', 'TIKTOK', 'INSTAGRAM'].includes(p));
      if (platforms.length === 1) {
        where.platform = platforms[0] as Platform;
      } else if (platforms.length > 1) {
        where.platform = { in: platforms as Platform[] };
      }
    }

    // Statuses that are always hidden from the user
    const HIDDEN_STATUSES = [ContentStatus.UNSUPPORTED, ContentStatus.FAILED, ContentStatus.ARCHIVED];

    // Status filter
    if (status && typeof status === 'string') {
      where.status = status as ContentStatus;
    }

    // Category filter (UX v2.0: active vs passed)
    const { category } = req.query;
    if (category === 'learning') {
      // Learning = everything except INBOX and hidden
      where.status = { notIn: [ContentStatus.INBOX, ...HIDDEN_STATUSES] };
    }
    // Default: if no category filter, show everything except INBOX and hidden
    if (!status && !category) {
      where.status = { notIn: [ContentStatus.INBOX, ...HIDDEN_STATUSES] };
    }

    // Filter out short TikTok/Instagram videos (<10s) — not useful for learning
    where.NOT = [
      {
        platform: { in: [Platform.TIKTOK, Platform.INSTAGRAM] },
        duration: { not: null, lt: 10 },
      },
    ];

    // Hybrid search: keyword + vector (for queries >= 3 chars)
    let vectorMatchIds: string[] = [];
    if (search && typeof search === 'string' && search.trim()) {
      const searchTerm = search.trim();

      // Always do keyword search
      where.OR = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { transcript: { text: { contains: searchTerm, mode: 'insensitive' } } },
      ];

      // For longer queries, also do vector search and merge results
      if (searchTerm.length >= 3) {
        try {
          const queryEmbedding = await generateEmbedding(searchTerm);
          const vectorResults = await prisma.$queryRaw<{ contentId: string; similarity: number }[]>`
            SELECT c.id as "contentId", 1 - (tc.embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
            FROM "TranscriptCache" tc
            JOIN "Content" c ON c."transcriptCacheId" = tc.id AND c."userId" = ${req.user!.id}
            WHERE tc.embedding IS NOT NULL
              AND 1 - (tc.embedding <=> ${JSON.stringify(queryEmbedding)}::vector) > 0.3
            ORDER BY tc.embedding <=> ${JSON.stringify(queryEmbedding)}::vector
            LIMIT 50
          `;
          vectorMatchIds = vectorResults.map(r => r.contentId);
        } catch (err) {
          // Graceful fallback: if embedding fails, keyword search still works
          log.warn({ err, search: searchTerm }, 'Vector search failed, falling back to keyword-only');
        }
      }

      // Merge: keyword OR vector match
      if (vectorMatchIds.length > 0) {
        where.OR.push({ id: { in: vectorMatchIds } });
      }
    }

    // Tags filter (comma-separated tag names)
    if (tags && typeof tags === 'string') {
      const tagNames = tags.split(',').map(t => t.trim()).filter(Boolean);
      if (tagNames.length > 0) {
        where.tags = {
          some: {
            name: { in: tagNames },
          },
        };
      }
    }

    // Theme filter (themeId from ContentTheme join table, supports comma-separated)
    const { themeId } = req.query;
    if (themeId && typeof themeId === 'string') {
      const themeIds = themeId.split(',').filter(Boolean);
      where.contentThemes = {
        some: themeIds.length === 1 ? { themeId: themeIds[0] } : { themeId: { in: themeIds } },
      };
    }

    // Channel filter (creator/author name)
    const { channel } = req.query;
    if (channel && typeof channel === 'string' && channel.trim()) {
      where.channelName = channel.trim();
    }

    // Date range filter
    if (dateFrom && typeof dateFrom === 'string') {
      const fromDate = new Date(dateFrom);
      if (!isNaN(fromDate.getTime())) {
        where.capturedAt = {
          ...(where.capturedAt as Prisma.DateTimeFilter || {}),
          gte: fromDate,
        };
      }
    }
    if (dateTo && typeof dateTo === 'string') {
      const toDate = new Date(dateTo);
      if (!isNaN(toDate.getTime())) {
        where.capturedAt = {
          ...(where.capturedAt as Prisma.DateTimeFilter || {}),
          lte: toDate,
        };
      }
    }

    // Sorting
    const validSortFields = ['capturedAt', 'title', 'createdAt'];
    const orderByField = validSortFields.includes(sortBy as string) ? sortBy as string : 'capturedAt';
    const orderByDirection = sortOrder === 'asc' ? 'asc' : 'desc';

    // Build orderBy array — always sort by date, nothing else
    const orderBy: Prisma.ContentOrderByWithRelationInput[] = [
      { [orderByField]: orderByDirection },
    ];

    const [rawContents, total] = await Promise.all([
      prisma.content.findMany({
        where,
        orderBy,
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
        include: {
          tags: true,
          contentThemes: {
            include: {
              theme: {
                select: { id: true, name: true, slug: true, color: true, emoji: true },
              },
            },
          },
          _count: {
            select: { quizzes: true },
          },
        },
      }),
      prisma.content.count({ where }),
    ]);

    const contents = rawContents.map(({ contentThemes, ...rest }) => ({
      ...rest,
      themes: contentThemes.map((ct) => ct.theme),
    }));

    return res.json({
      contents,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/content/tags - Get all tags for user's content
contentRouter.get('/tags', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tags = await prisma.tag.findMany({
      where: {
        contents: {
          some: {
            userId: req.user!.id,
          },
        },
      },
      include: {
        _count: {
          select: { contents: true },
        },
      },
      orderBy: {
        contents: {
          _count: 'desc',
        },
      },
    });

    return res.json(tags);
  } catch (error) {
    return next(error);
  }
});

// GET /api/content/channels - Get unique channel names for user's content
contentRouter.get('/channels', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get distinct channelNames with count
    const channels = await prisma.content.groupBy({
      by: ['channelName'],
      where: {
        userId: req.user!.id,
        channelName: { not: null },
        status: { not: ContentStatus.INBOX },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    // Filter out null and format response
    const result = channels
      .filter((c) => c.channelName !== null)
      .map((c) => ({
        name: c.channelName!,
        count: c._count.id,
      }));

    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

// PATCH /api/content/tags/:name - Rename a tag for user's content
// Since tags are global, we create a new tag and migrate the user's content
contentRouter.patch('/tags/:name', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const oldTagName = decodeURIComponent(asString(req.params.name)).toLowerCase().trim();
    const { newName } = req.body;

    if (!newName || typeof newName !== 'string') {
      return res.status(400).json({ error: 'newName is required and must be a string' });
    }

    const cleanNewName = newName.toLowerCase().trim();

    if (cleanNewName.length === 0 || cleanNewName.length > 50) {
      return res.status(400).json({ error: 'Tag name must be between 1 and 50 characters' });
    }

    if (oldTagName === cleanNewName) {
      return res.status(400).json({ error: 'New name is the same as current name' });
    }

    // Find the old tag
    const oldTag = await prisma.tag.findUnique({
      where: { name: oldTagName },
    });

    if (!oldTag) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    // Get all user's content with this tag
    const userContentWithTag = await prisma.content.findMany({
      where: {
        userId: req.user!.id,
        tags: {
          some: { id: oldTag.id },
        },
      },
      select: { id: true },
    });

    if (userContentWithTag.length === 0) {
      return res.status(404).json({ error: 'You have no content with this tag' });
    }

    // Create or find the new tag
    const newTag = await prisma.tag.upsert({
      where: { name: cleanNewName },
      create: { name: cleanNewName },
      update: {},
    });

    // Migrate user's content from old tag to new tag (batch SQL to avoid N+1)
    const contentIds = userContentWithTag.map((c) => c.id);
    await prisma.$transaction([
      prisma.$executeRaw`DELETE FROM "_ContentTags" WHERE "A" = ANY(${contentIds}::text[]) AND "B" = ${oldTag.id}`,
      prisma.$executeRaw`INSERT INTO "_ContentTags" ("A", "B") SELECT unnest(${contentIds}::text[]), ${newTag.id} ON CONFLICT DO NOTHING`,
    ]);

    return res.json({
      message: `Tag renamed from "${oldTagName}" to "${cleanNewName}"`,
      oldName: oldTagName,
      newName: cleanNewName,
      contentUpdated: userContentWithTag.length,
    });
  } catch (error) {
    return next(error);
  }
});

// DELETE /api/content/tags/:name - Remove a tag from all user's content
contentRouter.delete('/tags/:name', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tagName = decodeURIComponent(asString(req.params.name)).toLowerCase().trim();

    // Find the tag
    const tag = await prisma.tag.findUnique({
      where: { name: tagName },
    });

    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    // Get all user's content with this tag
    const userContentWithTag = await prisma.content.findMany({
      where: {
        userId: req.user!.id,
        tags: {
          some: { id: tag.id },
        },
      },
      select: { id: true },
    });

    if (userContentWithTag.length === 0) {
      return res.status(404).json({ error: 'You have no content with this tag' });
    }

    // Remove tag from all user's content (batch SQL to avoid N+1)
    const contentIds = userContentWithTag.map((c) => c.id);
    await prisma.$executeRaw`DELETE FROM "_ContentTags" WHERE "A" = ANY(${contentIds}::text[]) AND "B" = ${tag.id}`;

    return res.json({
      message: `Tag "${tagName}" removed from ${userContentWithTag.length} content(s)`,
      tagName,
      contentUpdated: userContentWithTag.length,
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/content/stats - Get content statistics for Stats page
contentRouter.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    // Total content count
    const total = await prisma.content.count({
      where: { userId },
    });

    // Count by platform
    const byPlatform = await prisma.content.groupBy({
      by: ['platform'],
      where: { userId },
      _count: { id: true },
    });

    // Count by status
    const byStatus = await prisma.content.groupBy({
      by: ['status'],
      where: { userId },
      _count: { id: true },
    });

    return res.json({
      total,
      byPlatform: byPlatform.map(p => ({
        platform: p.platform,
        count: p._count.id,
      })),
      byStatus: byStatus.map(s => ({
        status: s.status,
        count: s._count.id,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/content/pipeline-status - Batch pipeline status for processing content
contentRouter.get('/pipeline-status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    // All content currently in processing states
    const processing = await prisma.content.findMany({
      where: {
        userId,
        status: { in: [ContentStatus.SELECTED, ContentStatus.TRANSCRIBING, ContentStatus.GENERATING] },
      },
      select: { id: true, status: true, title: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });

    // Content that became READY in the last 5 minutes (for transition detection)
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentlyReady = await prisma.content.findMany({
      where: {
        userId,
        status: ContentStatus.READY,
        updatedAt: { gte: fiveMinAgo },
      },
      select: { id: true, title: true, updatedAt: true },
      take: 20,
    });

    return res.json({ processing, recentlyReady });
  } catch (error) {
    return next(error);
  }
});

// ============================================================================
// Inbox & Triage Endpoints (MUST be before /:id routes)
// ============================================================================

// GET /api/content/inbox - Get all inbox items
contentRouter.get('/inbox', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const skip = (pageNum - 1) * limitNum;

    const platform = req.query.platform as string | undefined;
    const where: any = {
      userId: req.user!.id,
      status: ContentStatus.INBOX,
      // Filter out short TikTok/Instagram videos (<10s)
      NOT: [
        {
          platform: { in: [Platform.TIKTOK, Platform.INSTAGRAM] },
          duration: { not: null, lt: 10 },
        },
      ],
    };
    // Platform filter (supports comma-separated: YOUTUBE,SPOTIFY)
    if (platform) {
      const platforms = platform.split(',').map(p => p.trim().toUpperCase()).filter(p => ['YOUTUBE', 'SPOTIFY', 'TIKTOK', 'INSTAGRAM'].includes(p));
      if (platforms.length === 1) {
        where.platform = platforms[0];
      } else if (platforms.length > 1) {
        where.platform = { in: platforms };
      }
    }

    const [contents, total] = await Promise.all([
      prisma.content.findMany({
        where,
        orderBy: { capturedAt: 'desc' },
        skip,
        take: limitNum,
        include: {
          tags: true,
        },
      }),
      prisma.content.count({ where }),
    ]);

    return res.json({
      contents,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/content/inbox/count - Get inbox count for badge
contentRouter.get('/inbox/count', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await prisma.content.count({
      where: {
        userId: req.user!.id,
        status: ContentStatus.INBOX,
        NOT: [
          {
            platform: { in: [Platform.TIKTOK, Platform.INSTAGRAM] },
            duration: { not: null, lt: 10 },
          },
        ],
      },
    });

    return res.json({ count });
  } catch (error) {
    return next(error);
  }
});

// Pipeline helper: quiz → auto-tag → theme classification (fire-and-forget)
async function quizThenClassify(contentId: string, userId: string, language: string = 'fr'): Promise<void> {
  await processContentQuiz(contentId, language);
  const tags = await autoTagContent(contentId, language);
  if (tags.length > 0) {
    await classifyContentForUser(contentId, userId, language);
    // If content couldn't be classified, check if we need new themes
    await evolveThemesForUser(userId, language);
  }
}

// POST /api/content/triage/bulk - Bulk triage multiple items
// Optimized: Triggers immediate quiz generation for items with existing transcripts
contentRouter.post('/triage/bulk', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contentIds, action } = req.body;

    if (!Array.isArray(contentIds) || contentIds.length === 0) {
      return res.status(400).json({ error: 'contentIds must be a non-empty array' });
    }

    if (!['learn', 'archive', 'delete'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Use "learn", "archive", or "delete".' });
    }

    // Verify ownership of all items (include transcript for optimization)
    const ownedContent = await prisma.content.findMany({
      where: {
        id: { in: contentIds },
        userId: req.user!.id,
      },
      include: { transcript: true, quizzes: true },
    });

    const ownedIds = ownedContent.map(c => c.id);

    if (ownedIds.length === 0) {
      return res.status(404).json({ error: 'No valid content found' });
    }

    let processed = 0;
    let processingStarted = 0;

    if (action === 'delete') {
      const result = await prisma.content.deleteMany({
        where: {
          id: { in: ownedIds },
        },
      });
      processed = result.count;
    } else {
      const newStatus = action === 'learn' ? ContentStatus.SELECTED : ContentStatus.ARCHIVED;
      const result = await prisma.content.updateMany({
        where: {
          id: { in: ownedIds },
        },
        data: { status: newStatus },
      });
      processed = result.count;

      // OPTIMIZATION: If "learn", trigger immediate processing pipeline
      // quiz → auto-tag → theme classification (all chained)
      if (action === 'learn') {
        const userId = req.user!.id;
        const userLang = req.user!.language;
        for (const content of ownedContent) {
          if (content.transcript && content.quizzes.length === 0) {
            // Has transcript, no quiz yet - generate quiz + tag + classify
            log.debug({ contentId: content.id, userId }, 'Bulk triage: triggering immediate pipeline');
            quizThenClassify(content.id, userId, userLang).catch((error) => {
              log.error({ err: error, contentId: content.id, userId }, 'Bulk triage pipeline failed');
            });
            processingStarted++;
          } else if (!content.transcript) {
            // No transcript - trigger full pipeline: transcribe → quiz → tag → classify
            const transcribe = content.platform === Platform.YOUTUBE
              ? processContentTranscript
              : content.platform === Platform.SPOTIFY
              ? processPodcastTranscript
              : content.platform === Platform.TIKTOK
              ? processTikTokTranscript
              : content.platform === Platform.INSTAGRAM
              ? processInstagramTranscript
              : null;

            if (transcribe) {
              transcribe(content.id)
                .then(async (success) => {
                  if (success) await quizThenClassify(content.id, userId, userLang);
                })
                .catch((err) => log.error({ err, contentId: content.id }, 'Bulk triage pipeline failed'));
              processingStarted++;
            }
          }
        }
      }
    }

    return res.json({
      success: true,
      processed,
      processingStarted,
      failed: contentIds.length - processed,
      message: `Successfully ${action === 'delete' ? 'deleted' : action === 'learn' ? 'added to learning' : 'archived'} ${processed} items${processingStarted > 0 ? ` (${processingStarted} processing started)` : ''}`,
    });
  } catch (error) {
    return next(error);
  }
});

// POST /api/content/selection-summary - Generate name + description for a multi-content selection
contentRouter.post('/selection-summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contentIds } = req.body;

    if (!Array.isArray(contentIds) || contentIds.length === 0) {
      return res.status(400).json({ error: 'contentIds must be a non-empty array' });
    }

    const contents = await prisma.content.findMany({
      where: { id: { in: contentIds } },
      select: { title: true, synopsis: true },
    });

    if (contents.length === 0) {
      return res.status(404).json({ error: 'No contents found' });
    }

    const titlesBlock = contents.map((c, i) => `${i + 1}. ${c.title}`).join('\n');

    const result = await generateText(
      `A partir de ces titres de contenus, genere:\n1. Un nom court (2-4 mots) qui capture le theme commun\n2. Une description courte (1 phrase, max 15 mots) qui resume ce que couvre ce quiz\n\nTitres:\n${titlesBlock}\n\nReponds en JSON:\n{"name": "...", "description": "..."}`,
      {
        system: 'Tu es un assistant concis. Reponds UNIQUEMENT en JSON valide. Le nom et la description doivent etre en francais.',
        temperature: 0.4,
        jsonMode: true,
      }
    );

    const parsed = JSON.parse(result) as { name: string; description: string };
    return res.json(parsed);
  } catch (error) {
    log.error({ err: error }, 'Failed to generate selection summary');
    return next(error);
  }
});

// POST /api/content/bulk-generate-quiz - Generate quiz for multiple contents
contentRouter.post('/bulk-generate-quiz', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contentIds } = req.body;

    if (!Array.isArray(contentIds) || contentIds.length === 0) {
      return res.status(400).json({ error: 'contentIds must be a non-empty array' });
    }

    // F8: Validate all elements are strings
    if (!contentIds.every((id): id is string => typeof id === 'string')) {
      return res.status(400).json({ error: 'contentIds must contain only strings' });
    }

    if (contentIds.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 items per batch' });
    }

    // Verify ownership and get eligible content
    const contents = await prisma.content.findMany({
      where: {
        id: { in: contentIds },
        userId: req.user!.id,
      },
      include: { transcript: true, quizzes: true },
    });

    if (contents.length === 0) {
      return res.status(404).json({ error: 'No valid content found' });
    }

    // F12: Use ContentStatus enum - Sets for type-safe status checks
    const processingStatuses = new Set<ContentStatus>([ContentStatus.GENERATING, ContentStatus.TRANSCRIBING]);
    const excludedStatuses = new Set<ContentStatus>([ContentStatus.GENERATING, ContentStatus.TRANSCRIBING, ContentStatus.FAILED, ContentStatus.UNSUPPORTED]);

    // Filter eligible: has transcript, no quizzes yet, not already processing
    const eligible = contents.filter(c =>
      c.transcript &&
      c.quizzes.length === 0 &&
      !processingStatuses.has(c.status)
    );

    // Filter needing transcription first
    const needsTranscript = contents.filter(c =>
      !c.transcript &&
      !excludedStatuses.has(c.status)
    );

    // F9: Use Sets for O(1) lookups
    const queuedSet = new Set<string>();
    const needsTranscriptSet = new Set(needsTranscript.map(c => c.id));

    const results = {
      queued: [] as string[],
      skipped: [] as { id: string; reason: string }[],
      needsTranscript: needsTranscript.map(c => c.id),
    };

    // Queue eligible for quiz generation
    for (const content of eligible) {
      // F3: Use ContentStatus enum
      await prisma.content.update({
        where: { id: content.id },
        data: { status: ContentStatus.GENERATING },
      });

      // Fire and forget - process in background
      processContentQuiz(content.id, req.user!.language).catch(err => {
        log.error({ err, contentId: content.id, userId: req.user!.id }, 'Bulk quiz generation failed');
      });

      results.queued.push(content.id);
      queuedSet.add(content.id);
    }

    // Mark skipped items (F9: O(1) lookups with Sets)
    for (const content of contents) {
      if (!queuedSet.has(content.id) && !needsTranscriptSet.has(content.id)) {
        let reason = 'Unknown';
        if (content.quizzes.length > 0) reason = 'Already has quiz';
        else if (processingStatuses.has(content.status)) reason = 'Already processing';
        else if (content.status === ContentStatus.FAILED) reason = 'Failed status';
        else if (content.status === ContentStatus.UNSUPPORTED) reason = 'Unsupported content';

        results.skipped.push({ id: content.id, reason });
      }
    }

    return res.json({
      success: true,
      message: `Queued ${results.queued.length} items for quiz generation`,
      results,
    });
  } catch (error) {
    return next(error);
  }
});

// ============================================================================
// Content Detail Routes (with :id parameter)
// ============================================================================

// GET /api/content/:id - Get single content with details
contentRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contentId = req.params.id as string;
    const content = await prisma.content.findFirst({
      where: {
        id: contentId,
        userId: req.user!.id,
      },
      include: {
        transcript: true,
        quizzes: true,
        tags: true,
        contentThemes: {
          include: {
            theme: {
              select: { id: true, name: true, slug: true, color: true, emoji: true },
            },
          },
        },
      },
    });

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    const { contentThemes, ...contentData } = content;
    return res.json({
      ...contentData,
      themes: contentThemes.map((ct) => ct.theme),
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/content/:id/similar - Get semantically similar content
contentRouter.get('/:id/similar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contentId = req.params.id as string;
    const userId = req.user!.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 5, 20);

    // Get the content and its transcript cache
    const content = await prisma.content.findFirst({
      where: { id: contentId, userId },
      select: { id: true, transcriptCacheId: true },
    });

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    if (!content.transcriptCacheId) {
      return res.json({ contentId, similar: [] });
    }

    // Find similar content via cosine similarity on TranscriptCache embeddings
    const similar = await prisma.$queryRaw<{
      id: string;
      title: string;
      platform: string;
      thumbnailUrl: string | null;
      channelName: string | null;
      similarity: number;
    }[]>`
      SELECT c.id, c.title, c.platform, c."thumbnailUrl", c."channelName",
             1 - (tc2.embedding <=> tc1.embedding) as similarity
      FROM "TranscriptCache" tc1
      JOIN "TranscriptCache" tc2 ON tc2.id != tc1.id AND tc2.embedding IS NOT NULL
      JOIN "Content" c ON c."transcriptCacheId" = tc2.id AND c."userId" = ${userId}
      WHERE tc1.id = ${content.transcriptCacheId}
        AND tc1.embedding IS NOT NULL
        AND c.id != ${contentId}
      ORDER BY tc2.embedding <=> tc1.embedding
      LIMIT ${limit}
    `;

    return res.json({
      contentId,
      similar: similar.map(s => ({
        ...s,
        similarity: Math.round(s.similarity * 1000) / 1000,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

// POST /api/content/:id/generate-quiz - Trigger quiz generation for content
contentRouter.post('/:id/generate-quiz', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contentId = req.params.id as string;
    const content = await prisma.content.findFirst({
      where: {
        id: contentId,
        userId: req.user!.id,
      },
      include: { transcript: true, quizzes: true },
    });

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    if (content.status !== 'SELECTED' && content.status !== 'FAILED') {
      return res.status(400).json({
        error: 'Content is already being processed or completed',
        status: content.status,
      });
    }

    // Update status to SELECTED (triggers transcription + quiz workers)
    await prisma.content.update({
      where: { id: content.id },
      data: { status: ContentStatus.SELECTED },
    });

    // Process in background based on platform
    const selectLang = req.user!.language;
    if (content.platform === Platform.YOUTUBE) {
      // YouTube: Fast, free transcription via subtitles
      if (!content.transcript) {
        processContentTranscript(content.id)
          .then(async (success) => {
            if (success) {
              // After transcription, trigger quiz generation
              await processContentQuiz(content.id, selectLang);
            }
          })
          .catch((error) => {
            log.error({ err: error, contentId: content.id }, 'YouTube processing failed');
          });
      } else if (content.quizzes.length === 0) {
        // Already has transcript, just generate quiz
        processContentQuiz(content.id, selectLang).catch((error) => {
          log.error({ err: error, contentId: content.id }, 'Quiz generation failed');
        });
      }
    } else if (content.platform === Platform.SPOTIFY) {
      // Spotify: Slower, paid transcription via Whisper
      if (!content.transcript) {
        processPodcastTranscript(content.id)
          .then(async (success) => {
            if (success) {
              await processContentQuiz(content.id, selectLang);
            }
          })
          .catch((error) => {
            log.error({ err: error, contentId: content.id }, 'Podcast processing failed');
          });
      } else if (content.quizzes.length === 0) {
        processContentQuiz(content.id, selectLang).catch((error) => {
          log.error({ err: error, contentId: content.id }, 'Quiz generation failed');
        });
      }
    }

    const updated = await prisma.content.findFirst({
      where: { id: content.id },
    });

    return res.json({
      message: content.platform === Platform.YOUTUBE
        ? 'Processing started - quiz will be generated shortly'
        : 'Podcast queued for processing (this may take a few minutes)',
      content: updated,
    });
  } catch (error) {
    return next(error);
  }
});

// POST /api/content/:id/regenerate-quiz - Regenerate quiz questions
contentRouter.post('/:id/regenerate-quiz', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contentId = req.params.id as string;
    const content = await prisma.content.findFirst({
      where: {
        id: contentId,
        userId: req.user!.id,
      },
      include: { transcript: true },
    });

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    if (!content.transcript) {
      return res.status(400).json({
        error: 'Content has no transcript - cannot regenerate quiz',
      });
    }

    // Regenerate quiz in background
    regenerateQuiz(content.id, req.user!.language).catch((error) => {
      log.error({ err: error, contentId: content.id }, 'Quiz regeneration failed');
    });

    return res.json({
      message: 'Quiz regeneration started',
      contentId: content.id,
    });
  } catch (error) {
    return next(error);
  }
});

// POST /api/content/:id/retry - Retry failed transcription
contentRouter.post('/:id/retry', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contentId = req.params.id as string;
    const content = await prisma.content.findFirst({
      where: {
        id: contentId,
        userId: req.user!.id,
      },
    });

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    if (content.status !== 'FAILED') {
      return res.status(400).json({
        error: 'Can only retry failed content',
        status: content.status,
      });
    }

    // Reset status and retry
    await prisma.content.update({
      where: { id: content.id },
      data: { status: ContentStatus.SELECTED },
    });

    // Process immediately based on platform
    if (content.platform === Platform.YOUTUBE) {
      processContentTranscript(content.id).catch((error) => {
        log.error({ err: error, contentId: content.id }, 'Retry transcript failed');
      });
    } else if (content.platform === Platform.SPOTIFY) {
      processPodcastTranscript(content.id).catch((error) => {
        log.error({ err: error, contentId: content.id }, 'Retry podcast transcript failed');
      });
    }

    return res.json({ message: 'Retry initiated', contentId: content.id });
  } catch (error) {
    return next(error);
  }
});

// POST /api/content/bulk-retry - Retry multiple failed contents
contentRouter.post('/bulk-retry', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contentIds } = req.body;

    if (!Array.isArray(contentIds) || contentIds.length === 0) {
      return res.status(400).json({ error: 'contentIds must be a non-empty array' });
    }

    // Get all failed contents for this user
    const contents = await prisma.content.findMany({
      where: {
        id: { in: contentIds },
        userId: req.user!.id,
        status: ContentStatus.FAILED,
      },
    });

    if (contents.length === 0) {
      return res.status(404).json({ error: 'No failed content found to retry' });
    }

    // Reset status to SELECTED for all failed contents
    await prisma.content.updateMany({
      where: {
        id: { in: contents.map(c => c.id) },
      },
      data: { status: ContentStatus.SELECTED },
    });

    // Process each content based on platform
    const retried: string[] = [];
    for (const content of contents) {
      if (content.platform === Platform.YOUTUBE) {
        processContentTranscript(content.id).catch((error) => {
          log.error({ err: error, contentId: content.id }, 'Bulk retry transcript failed');
        });
      } else if (content.platform === Platform.SPOTIFY) {
        processPodcastTranscript(content.id).catch((error) => {
          log.error({ err: error, contentId: content.id }, 'Bulk retry podcast transcript failed');
        });
      } else if (content.platform === Platform.TIKTOK) {
        // TikTok uses same transcription service as YouTube
        processContentTranscript(content.id).catch((error) => {
          log.error({ err: error, contentId: content.id }, 'Bulk retry TikTok transcript failed');
        });
      }
      retried.push(content.id);
    }

    return res.json({
      success: true,
      message: `${retried.length} content(s) queued for retry`,
      retried,
      skipped: contentIds.filter(id => !retried.includes(id)),
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/content/:id/status - Get content processing status
contentRouter.get('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contentId = req.params.id as string;
    const content = await prisma.content.findFirst({
      where: {
        id: contentId,
        userId: req.user!.id,
      },
      select: {
        id: true,
        status: true,
        platform: true,
        title: true,
        transcript: {
          select: {
            id: true,
            language: true,
            source: true,
            createdAt: true,
          },
        },
        _count: {
          select: { quizzes: true },
        },
      },
    });

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    return res.json({
      ...content,
      hasTranscript: !!content.transcript,
      quizCount: content._count.quizzes,
    });
  } catch (error) {
    return next(error);
  }
});

// DELETE /api/content/:id - Delete content
contentRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contentId = req.params.id as string;
    const content = await prisma.content.findFirst({
      where: {
        id: contentId,
        userId: req.user!.id,
      },
    });

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    await prisma.content.delete({
      where: { id: content.id },
    });

    return res.json({ message: 'Content deleted successfully' });
  } catch (error) {
    return next(error);
  }
});

// POST /api/content/:id/auto-tag - Auto-generate tags for content
contentRouter.post('/:id/auto-tag', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contentId = req.params.id as string;
    const content = await prisma.content.findFirst({
      where: {
        id: contentId,
        userId: req.user!.id,
      },
      include: { transcript: true },
    });

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    if (!content.transcript) {
      return res.status(400).json({ error: 'Content has no transcript - cannot generate tags' });
    }

    const tags = await autoTagContent(contentId, req.user!.language);

    return res.json({
      message: 'Tags generated successfully',
      tags,
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/content/:id/memo - Get or generate AI memo for content
contentRouter.get('/:id/memo', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contentId = req.params.id as string;
    const content = await prisma.content.findFirst({
      where: {
        id: contentId,
        userId: req.user!.id,
      },
      include: { transcript: true, tags: true },
    });

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    if (!content.transcript) {
      return res.status(400).json({ error: 'Content has no transcript - cannot generate memo' });
    }

    // Check if memo already exists on Content
    if (content.memo) {
      return res.json({
        memo: content.memo,
        generatedAt: content.memoGeneratedAt?.toISOString() ?? null,
        cached: true,
      });
    }

    // Generate carousel memo with creator context for self-reference effect
    const tagNames = content.tags.map(t => t.name);
    const creatorContext = buildCreatorContextForMemo(
      content.platform,
      content.channelName,
      content.authorUsername,
      content.showName,
      content.capturedAt
    );
    // Note: contextCues not available here (extracted during quiz generation only)
    const memo = await generateMemoFromTranscript(
      content.transcript.text,
      content.title,
      tagNames,
      creatorContext,
      [], // contextCues not stored in DB yet
      req.user!.language
    );

    // Cache the memo on Content
    const now = new Date();
    await prisma.content.update({
      where: { id: contentId },
      data: { memo, memoGeneratedAt: now },
    });

    return res.json({
      memo,
      generatedAt: now.toISOString(),
      cached: false,
    });
  } catch (error) {
    return next(error);
  }
});

// POST /api/content/:id/memo/regenerate - Force regenerate memo
contentRouter.post('/:id/memo/regenerate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contentId = req.params.id as string;
    const content = await prisma.content.findFirst({
      where: {
        id: contentId,
        userId: req.user!.id,
      },
      include: { transcript: true, tags: true },
    });

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    if (!content.transcript) {
      return res.status(400).json({ error: 'Content has no transcript - cannot generate memo' });
    }

    // Generate new carousel memo with creator context for self-reference effect
    const tagNames = content.tags.map(t => t.name);
    const creatorContext = buildCreatorContextForMemo(
      content.platform,
      content.channelName,
      content.authorUsername,
      content.showName,
      content.capturedAt
    );
    // Note: contextCues not available here (extracted during quiz generation only)
    const memo = await generateMemoFromTranscript(
      content.transcript.text,
      content.title,
      tagNames,
      creatorContext,
      [], // contextCues not stored in DB yet
      req.user!.language
    );

    // Update cached memo on Content
    const now = new Date();
    await prisma.content.update({
      where: { id: contentId },
      data: { memo, memoGeneratedAt: now },
    });

    return res.json({
      memo,
      generatedAt: now.toISOString(),
      regenerated: true,
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/content/topic/:name/memo - Get or generate memo for a topic (aggregated from all contents)
contentRouter.get('/topic/:name/memo', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const topicName = decodeURIComponent(asString(req.params.name));
    const userId = req.user!.id;

    // Get all contents with this tag
    const contents = await prisma.content.findMany({
      where: {
        userId,
        status: 'READY',
        tags: {
          some: { name: topicName },
        },
      },
      include: {
        transcript: true,
        tags: true,
      },
    });

    if (contents.length === 0) {
      return res.status(404).json({ error: 'No content found for this topic' });
    }

    // Collect memos from all contents
    const contentMemos: string[] = [];
    for (const content of contents) {
      if (content.memo) {
        contentMemos.push(`**${content.title}**\n${content.memo}`);
      }
    }

    if (contentMemos.length === 0) {
      // Generate memos for contents that don't have one yet
      return res.status(400).json({
        error: 'No memos available yet. Please view individual content memos first.',
        hint: 'Memos are generated when you view a content\'s memo page.'
      });
    }

    // Create aggregated topic memo
    const systemPrompt = `Tu es un assistant d'apprentissage expert. À partir des mémos individuels fournis, crée un mémo de synthèse pour le thème "${topicName}".
Le mémo doit:
- Synthétiser les points clés communs et complémentaires
- Organiser les concepts de manière logique
- Être structuré en sections avec des bullet points
- Mettre en évidence les connexions entre les différents contenus
- Faire maximum 300 mots
- Être entièrement en français`;

    const userPrompt = `Thème: ${topicName}
Nombre de contenus: ${contentMemos.length}

Mémos individuels:
${contentMemos.join('\n\n---\n\n')}

Génère un mémo de synthèse pour ce thème.`;

    const memo = await generateText(userPrompt, { system: systemPrompt, temperature: 0.7 });

    return res.json({
      memo,
      topicName,
      contentCount: contents.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return next(error);
  }
});

// PUT /api/content/:id/tags - Update content tags manually
contentRouter.put('/:id/tags', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contentId = req.params.id as string;
    const { tags } = req.body;

    if (!Array.isArray(tags)) {
      return res.status(400).json({ error: 'Tags must be an array of strings' });
    }

    const content = await prisma.content.findFirst({
      where: {
        id: contentId,
        userId: req.user!.id,
      },
    });

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Clean and validate tags
    const cleanTags = tags
      .filter((tag): tag is string => typeof tag === 'string')
      .map(tag => tag.toLowerCase().trim())
      .filter(tag => tag.length > 0 && tag.length <= 50);

    // Create or find tags
    const tagRecords = await Promise.all(
      cleanTags.map(async (name) => {
        return prisma.tag.upsert({
          where: { name },
          create: { name },
          update: {},
        });
      })
    );

    // Update content with new tags (replace all)
    await prisma.content.update({
      where: { id: contentId },
      data: {
        tags: {
          set: tagRecords.map(t => ({ id: t.id })),
        },
      },
    });

    const updated = await prisma.content.findUnique({
      where: { id: contentId },
      include: { tags: true },
    });

    return res.json({
      message: 'Tags updated successfully',
      tags: updated?.tags || [],
    });
  } catch (error) {
    return next(error);
  }
});

// PATCH /api/content/:id/triage - Triage a single content item
// Optimized: If transcript already exists (pre-transcription), triggers quiz generation immediately
contentRouter.patch('/:id/triage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = asString(req.params.id);
    const { action } = req.body;

    if (!['learn', 'archive', 'undo'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Use "learn", "archive", or "undo".' });
    }

    // Verify ownership and get transcript status
    const content = await prisma.content.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
      include: { transcript: true, quizzes: true },
    });

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Undo: reset back to INBOX (no pipeline trigger)
    if (action === 'undo') {
      const updated = await prisma.content.update({
        where: { id },
        data: { status: ContentStatus.INBOX },
      });
      return res.json({
        success: true,
        newStatus: updated.status,
        message: 'Content reset to inbox',
      });
    }

    const newStatus = action === 'learn' ? ContentStatus.SELECTED : ContentStatus.ARCHIVED;

    const updated = await prisma.content.update({
      where: { id },
      data: { status: newStatus },
    });

    // OPTIMIZATION: If user clicks "Learn" and transcript already exists (pre-transcription),
    // trigger quiz generation immediately instead of waiting for cron
    let processingStarted = false;
    const triageLang = req.user!.language;
    if (action === 'learn' && content.transcript && content.quizzes.length === 0) {
      log.debug({ contentId: id, userId: req.user!.id }, 'Triage: triggering immediate quiz for transcribed content');
      processContentQuiz(id, triageLang).catch((error) => {
        log.error({ err: error, contentId: id }, 'Triage quiz generation failed');
      });
      processingStarted = true;
    } else if (action === 'learn' && !content.transcript) {
      // No transcript yet - trigger transcription + quiz pipeline
      if (content.platform === Platform.YOUTUBE) {
        processContentTranscript(id)
          .then(async (success) => {
            if (success) {
              await processContentQuiz(id, triageLang);
            }
          })
          .catch((error) => {
            log.error({ err: error, contentId: id }, 'Triage processing failed');
          });
        processingStarted = true;
      } else if (content.platform === Platform.SPOTIFY) {
        processPodcastTranscript(id)
          .then(async (success) => {
            if (success) {
              await processContentQuiz(id, triageLang);
            }
          })
          .catch((error) => {
            log.error({ err: error, contentId: id }, 'Triage podcast processing failed');
          });
        processingStarted = true;
      } else if (content.platform === Platform.TIKTOK) {
        processTikTokTranscript(id)
          .then(async (success) => {
            if (success) {
              await processContentQuiz(id, triageLang);
            }
          })
          .catch((error) => {
            log.error({ err: error, contentId: id }, 'Triage tiktok processing failed');
          });
        processingStarted = true;
      } else if (content.platform === Platform.INSTAGRAM) {
        processInstagramTranscript(id)
          .then(async (success) => {
            if (success) {
              await processContentQuiz(id, triageLang);
            }
          })
          .catch((error) => {
            log.error({ err: error, contentId: id }, 'Triage instagram processing failed');
          });
        processingStarted = true;
      }
    }

    return res.json({
      success: true,
      newStatus: updated.status,
      processingStarted,
      hasTranscript: !!content.transcript,
      message: action === 'learn'
        ? (processingStarted ? 'Content added to learning - quiz generation started!' : 'Content added to learning queue')
        : 'Content archived',
    });
  } catch (error) {
    return next(error);
  }
});

// DELETE /api/content/:id - Delete a single content item
contentRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = asString(req.params.id);

    // Verify ownership
    const content = await prisma.content.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
    });

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    await prisma.content.delete({
      where: { id },
    });

    return res.json({
      success: true,
      message: 'Content deleted successfully',
    });
  } catch (error) {
    return next(error);
  }
});
