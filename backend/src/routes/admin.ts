// Admin routes for manual job triggers and monitoring
import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { triggerJob, getSchedulerStatus, runAllSyncsNow } from '../workers/scheduler.js';

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

// POST /api/admin/sync/all - Trigger all sync jobs
adminRouter.post('/sync/all', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await runAllSyncsNow();
    res.json({ success: true, message: 'All sync jobs completed' });
  } catch (error) {
    next(error);
  }
});
