// Admin routes for manual job triggers and monitoring
import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { triggerJob, getSchedulerStatus, runAllSyncsNow } from '../workers/scheduler.js';
import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';
import { backfillThemeImages } from '../services/themeImageMatching.js';

const log = logger.child({ route: 'admin' });

export const adminRouter = Router();

// All admin routes require authentication
adminRouter.use(authenticateToken);

// GET /api/admin/scheduler/status - Get scheduler status
adminRouter.get('/scheduler/status', (_req: Request, res: Response) => {
  const status = getSchedulerStatus();
  res.json(status);
});

// POST /api/admin/sync/youtube - Trigger YouTube sync manually
adminRouter.post('/sync/youtube', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await triggerJob('youtube');
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/sync/spotify - Trigger Spotify sync manually
adminRouter.post('/sync/spotify', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await triggerJob('spotify');
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/sync/tiktok - Trigger TikTok sync manually
adminRouter.post('/sync/tiktok', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await triggerJob('tiktok');
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/sync/instagram - Trigger Instagram sync manually
adminRouter.post('/sync/instagram', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await triggerJob('instagram');
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/sync/tiktok-transcription - Trigger TikTok transcription worker manually
adminRouter.post('/sync/tiktok-transcription', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await triggerJob('tiktok-transcription');
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/sync/instagram-transcription - Trigger Instagram transcription worker manually
adminRouter.post('/sync/instagram-transcription', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await triggerJob('instagram-transcription');
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/sync/transcription - Trigger YouTube transcription worker manually
adminRouter.post('/sync/transcription', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await triggerJob('transcription');
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/sync/podcast-transcription - Trigger podcast transcription worker manually
adminRouter.post('/sync/podcast-transcription', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await triggerJob('podcast-transcription');
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/sync/quiz-generation - Trigger quiz generation worker manually
adminRouter.post('/sync/quiz-generation', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await triggerJob('quiz-generation');
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/sync/reminder - Trigger reminder worker manually
adminRouter.post('/sync/reminder', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await triggerJob('reminder');
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/sync/auto-tagging - Trigger auto-tagging worker manually
adminRouter.post('/sync/auto-tagging', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await triggerJob('auto-tagging');
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/sync/theme-classification - Trigger theme classification worker manually
adminRouter.post('/sync/theme-classification', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await triggerJob('theme-classification');
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/sync/theme-backfill - Trigger theme backfill manually (one-time)
adminRouter.post('/sync/theme-backfill', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await triggerJob('theme-backfill');
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/sync/embedding-generation - Trigger embedding generation worker manually
adminRouter.post('/sync/embedding-generation', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await triggerJob('embedding-generation', 'MANUAL');
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/sync/embedding-backfill - Trigger embedding backfill (runs in background)
adminRouter.post('/sync/embedding-backfill', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // Start backfill in background, don't await
    triggerJob('embedding-backfill', 'MANUAL').catch(err => log.error({ err }, 'Embedding backfill failed'));
    res.json({ success: true, message: 'Embedding backfill started in background' });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/sync/synopsis-backfill - Trigger synopsis backfill (runs in background)
adminRouter.post('/sync/synopsis-backfill', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    triggerJob('synopsis-backfill', 'MANUAL').catch(err => log.error({ err }, 'Synopsis backfill failed'));
    res.json({ success: true, message: 'Synopsis backfill started in background' });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/sync/theme-progress - Trigger theme progress worker manually
adminRouter.post('/sync/theme-progress', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await triggerJob('theme-progress', 'MANUAL');
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/sync/theme-progress-backfill - Backfill ThemeProgress for existing themes
adminRouter.post('/sync/theme-progress-backfill', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    triggerJob('theme-progress-backfill', 'MANUAL').catch(err => log.error({ err }, 'Theme progress backfill failed'));
    res.json({ success: true, message: 'Theme progress backfill started in background' });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/embeddings/status - Get embedding coverage stats
adminRouter.get('/embeddings/status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await prisma.$queryRaw<{ total: bigint; with_embedding: bigint; without_embedding: bigint }[]>`
      SELECT
        COUNT(*) as total,
        COUNT(embedding) as with_embedding,
        COUNT(*) - COUNT(embedding) as without_embedding
      FROM "TranscriptCache"
      WHERE text IS NOT NULL AND length(text) > 50
    `;

    const total = Number(stats[0].total);
    const withEmbedding = Number(stats[0].with_embedding);
    const withoutEmbedding = Number(stats[0].without_embedding);

    res.json({
      total,
      withEmbedding,
      withoutEmbedding,
      coveragePercent: total > 0 ? Math.round((withEmbedding / total) * 100) : 0,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/sync/theme-images-backfill - Backfill theme images for existing themes
adminRouter.post('/sync/theme-images-backfill', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await backfillThemeImages();
    res.json({ success: true, updated });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/sync/all - Trigger all sync jobs (runs in background)
adminRouter.post('/sync/all', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // Start sync in background, don't await
    runAllSyncsNow().catch(err => log.error({ err }, 'Manual sync-all failed'));
    // Return immediately
    res.json({ success: true, message: 'All sync jobs started in background' });
  } catch (error) {
    next(error);
  }
});
