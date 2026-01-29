import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { ContentStatus, Platform, Prisma } from '@prisma/client';
import { processContentTranscript } from '../services/transcription.js';
import { processPodcastTranscript } from '../services/podcastTranscription.js';
import { processContentQuiz, regenerateQuiz } from '../services/quizGeneration.js';
import { autoTagContent } from '../services/tagging.js';

export const contentRouter = Router();

// All content routes require authentication
contentRouter.use(authenticateToken);

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
      sortBy = 'capturedAt',
      sortOrder = 'desc',
    } = req.query;

    const where: Prisma.ContentWhereInput = {
      userId: req.user!.id,
    };

    // Platform filter
    if (platform && typeof platform === 'string' && ['YOUTUBE', 'SPOTIFY', 'TIKTOK'].includes(platform)) {
      where.platform = platform as Platform;
    }

    // Status filter
    if (status && typeof status === 'string') {
      where.status = status as ContentStatus;
    }

    // Category filter (learning vs archived)
    const { category } = req.query;
    if (category === 'learning') {
      // Learning = everything except INBOX and ARCHIVED
      where.status = { notIn: [ContentStatus.INBOX, ContentStatus.ARCHIVED] };
    } else if (category === 'archived') {
      where.status = ContentStatus.ARCHIVED;
    }
    // Default: exclude INBOX from main library view (unless explicitly requested)
    if (!status && !category) {
      where.status = { not: ContentStatus.INBOX };
    }

    // Full-text search on title, description, and transcript
    if (search && typeof search === 'string' && search.trim()) {
      const searchTerm = search.trim();
      where.OR = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { transcript: { text: { contains: searchTerm, mode: 'insensitive' } } },
      ];
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

    // Build orderBy array - prioritize listened content for Spotify
    const orderBy: Prisma.ContentOrderByWithRelationInput[] = [];

    // If filtering by Spotify or showing all, sort by listen progress first
    if (!platform || platform === 'SPOTIFY') {
      orderBy.push({ fullyPlayed: 'desc' });  // Fully played first
      orderBy.push({ listenProgress: 'desc' }); // Then by progress percentage
    }

    // Then apply the user's sort preference
    orderBy.push({ [orderByField]: orderByDirection });

    const [contents, total] = await Promise.all([
      prisma.content.findMany({
        where,
        orderBy,
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
        include: {
          tags: true,
          _count: {
            select: { quizzes: true },
          },
        },
      }),
      prisma.content.count({ where }),
    ]);

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
      },
    });

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    return res.json(content);
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

    if (content.status !== 'PENDING' && content.status !== 'FAILED') {
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
    if (content.platform === Platform.YOUTUBE) {
      // YouTube: Fast, free transcription via subtitles
      if (!content.transcript) {
        processContentTranscript(content.id)
          .then(async (success) => {
            if (success) {
              // After transcription, trigger quiz generation
              await processContentQuiz(content.id);
            }
          })
          .catch((error) => {
            console.error(`[Content] Failed to process YouTube ${content.id}:`, error);
          });
      } else if (content.quizzes.length === 0) {
        // Already has transcript, just generate quiz
        processContentQuiz(content.id).catch((error) => {
          console.error(`[Content] Failed to generate quiz for ${content.id}:`, error);
        });
      }
    } else if (content.platform === Platform.SPOTIFY) {
      // Spotify: Slower, paid transcription via Whisper
      if (!content.transcript) {
        processPodcastTranscript(content.id)
          .then(async (success) => {
            if (success) {
              await processContentQuiz(content.id);
            }
          })
          .catch((error) => {
            console.error(`[Content] Failed to process podcast ${content.id}:`, error);
          });
      } else if (content.quizzes.length === 0) {
        processContentQuiz(content.id).catch((error) => {
          console.error(`[Content] Failed to generate quiz for ${content.id}:`, error);
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
    regenerateQuiz(content.id).catch((error) => {
      console.error(`[Content] Failed to regenerate quiz for ${content.id}:`, error);
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
        console.error(`[Content] Failed to retry transcript for ${content.id}:`, error);
      });
    } else if (content.platform === Platform.SPOTIFY) {
      processPodcastTranscript(content.id).catch((error) => {
        console.error(`[Content] Failed to retry podcast transcript for ${content.id}:`, error);
      });
    }

    return res.json({ message: 'Retry initiated', contentId: content.id });
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

    const tags = await autoTagContent(contentId);

    return res.json({
      message: 'Tags generated successfully',
      tags,
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

// ============================================================================
// Inbox & Triage Endpoints
// ============================================================================

// GET /api/content/inbox - Get all inbox items
contentRouter.get('/inbox', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '50' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const skip = (pageNum - 1) * limitNum;

    const [contents, total] = await Promise.all([
      prisma.content.findMany({
        where: {
          userId: req.user!.id,
          status: ContentStatus.INBOX,
        },
        orderBy: { capturedAt: 'desc' },
        skip,
        take: limitNum,
        include: {
          tags: true,
        },
      }),
      prisma.content.count({
        where: {
          userId: req.user!.id,
          status: ContentStatus.INBOX,
        },
      }),
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
      },
    });

    return res.json({ count });
  } catch (error) {
    return next(error);
  }
});

// PATCH /api/content/:id/triage - Triage a single content item
contentRouter.patch('/:id/triage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { action } = req.body;

    if (!['learn', 'archive'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Use "learn" or "archive".' });
    }

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

    const newStatus = action === 'learn' ? ContentStatus.SELECTED : ContentStatus.ARCHIVED;

    const updated = await prisma.content.update({
      where: { id },
      data: { status: newStatus },
    });

    return res.json({
      success: true,
      newStatus: updated.status,
      message: action === 'learn' ? 'Content added to learning queue' : 'Content archived',
    });
  } catch (error) {
    return next(error);
  }
});

// POST /api/content/triage/bulk - Bulk triage multiple items
contentRouter.post('/triage/bulk', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contentIds, action } = req.body;

    if (!Array.isArray(contentIds) || contentIds.length === 0) {
      return res.status(400).json({ error: 'contentIds must be a non-empty array' });
    }

    if (!['learn', 'archive', 'delete'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Use "learn", "archive", or "delete".' });
    }

    // Verify ownership of all items
    const ownedContent = await prisma.content.findMany({
      where: {
        id: { in: contentIds },
        userId: req.user!.id,
      },
      select: { id: true },
    });

    const ownedIds = ownedContent.map(c => c.id);

    if (ownedIds.length === 0) {
      return res.status(404).json({ error: 'No valid content found' });
    }

    let processed = 0;

    if (action === 'delete') {
      // Delete content (cascades to transcripts, quizzes, etc.)
      const result = await prisma.content.deleteMany({
        where: {
          id: { in: ownedIds },
        },
      });
      processed = result.count;
    } else {
      // Update status
      const newStatus = action === 'learn' ? ContentStatus.SELECTED : ContentStatus.ARCHIVED;
      const result = await prisma.content.updateMany({
        where: {
          id: { in: ownedIds },
        },
        data: { status: newStatus },
      });
      processed = result.count;
    }

    return res.json({
      success: true,
      processed,
      failed: contentIds.length - processed,
      message: `Successfully ${action === 'delete' ? 'deleted' : action === 'learn' ? 'added to learning' : 'archived'} ${processed} items`,
    });
  } catch (error) {
    return next(error);
  }
});

// DELETE /api/content/:id - Delete a single content item
contentRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

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
