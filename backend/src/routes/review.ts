import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { Rating, Platform } from '@prisma/client';
import { generateText } from '../services/llm.js';

// Helper to safely extract string param (handles string | string[] | undefined)
function asString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

export const reviewRouter = Router();

// All review routes require authentication
reviewRouter.use(authenticateToken);

// GET /api/reviews - Get contents that have been quizzed at least once
reviewRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    // Get contents that have at least one review (quiz has been done)
    const contentsWithReviews = await prisma.content.findMany({
      where: {
        userId,
        status: 'READY',
        quizzes: {
          some: {
            cards: {
              some: {
                reviews: {
                  some: {}, // At least one review exists
                },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        platform: true,
        thumbnailUrl: true,
        tags: { select: { name: true } },
      },
    });

    // Transform to expected format
    const items = contentsWithReviews.map(content => ({
      id: content.id,
      contentId: content.id,
      contentTitle: content.title,
      source: content.platform.toLowerCase(),
      thumbnailUrl: content.thumbnailUrl,
      topics: content.tags.map(t => t.name),
    }));

    // Also get topics that have been quizzed (contents with reviews grouped by tag)
    // We need to count ONLY contents that have been quizzed, not all contents
    const topicsWithReviews = await prisma.tag.findMany({
      where: {
        contents: {
          some: {
            userId,
            status: 'READY',
            quizzes: {
              some: {
                cards: {
                  some: {
                    reviews: {
                      some: {},
                    },
                  },
                },
              },
            },
          },
        },
      },
      select: {
        name: true,
        contents: {
          where: {
            userId,
            status: 'READY',
            quizzes: {
              some: {
                cards: {
                  some: {
                    reviews: {
                      some: {},
                    },
                  },
                },
              },
            },
          },
          select: { id: true },
        },
      },
    });

    // Only include topics with 2+ QUIZZED contents (single content = same as content memo)
    const topics = topicsWithReviews
      .filter(tag => tag.contents.length >= 2)
      .map(tag => ({
        id: `topic:${tag.name}`,
        type: 'topic' as const,
        name: tag.name,
        contentCount: tag.contents.length,
      }));

    // Get themes that have at least one quizzed content
    const themesWithReviews = await prisma.theme.findMany({
      where: {
        userId,
        contentThemes: {
          some: {
            content: {
              status: 'READY',
              quizzes: {
                some: {
                  cards: {
                    some: {
                      reviews: {
                        some: {},
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        emoji: true,
        color: true,
        contentThemes: {
          where: {
            content: {
              status: 'READY',
              quizzes: {
                some: {
                  cards: {
                    some: {
                      reviews: {
                        some: {},
                      },
                    },
                  },
                },
              },
            },
          },
          select: { id: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const themes = themesWithReviews.map(t => ({
      id: t.id,
      name: t.name,
      emoji: t.emoji,
      color: t.color,
      quizzedContentCount: t.contentThemes.length,
    }));

    return res.json({ items, topics, themes });
  } catch (error) {
    return next(error);
  }
});

// GET /api/reviews/due - Get cards due for review
// Returns review cards (already seen) + new cards (up to daily limit)
reviewRouter.get('/due', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit = '50' } = req.query;
    const userId = req.user!.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get user's new cards per day setting
    const settings = await prisma.userSettings.findUnique({
      where: { userId },
    });
    const newCardsPerDay = settings?.newCardsPerDay ?? 20;

    // Count cards that had their first review today (cards that went from 0 to 1 repetition)
    const firstReviewsToday = await prisma.review.count({
      where: {
        userId,
        createdAt: { gte: today },
        card: {
          repetitions: 1, // Card has exactly 1 repetition = first review just happened
        },
      },
    });

    const remainingNewCardsToday = Math.max(0, newCardsPerDay - firstReviewsToday);

    // 1. Get review cards (already seen at least once, due now) - oldest first
    const reviewCards = await prisma.card.findMany({
      where: {
        userId,
        repetitions: { gt: 0 }, // Has been reviewed before
        nextReviewAt: { lte: new Date() },
      },
      orderBy: { nextReviewAt: 'asc' },
      take: parseInt(limit as string),
      include: {
        quiz: {
          include: {
            content: {
              select: {
                id: true,
                title: true,
                url: true,
                platform: true,
              },
            },
          },
        },
      },
    });

    // 2. Get new cards (never reviewed, up to daily limit)
    const newCards = await prisma.card.findMany({
      where: {
        userId,
        repetitions: 0, // Never reviewed
        nextReviewAt: { lte: new Date() },
      },
      orderBy: { createdAt: 'asc' }, // Oldest new cards first
      take: remainingNewCardsToday,
      include: {
        quiz: {
          include: {
            content: {
              select: {
                id: true,
                title: true,
                url: true,
                platform: true,
              },
            },
          },
        },
      },
    });

    // Combine: review cards first, then new cards
    const cards = [...reviewCards, ...newCards].slice(0, parseInt(limit as string));

    // Count total due (for stats)
    const [totalReviewDue, totalNewDue] = await Promise.all([
      prisma.card.count({
        where: {
          userId,
          repetitions: { gt: 0 },
          nextReviewAt: { lte: new Date() },
        },
      }),
      prisma.card.count({
        where: {
          userId,
          repetitions: 0,
          nextReviewAt: { lte: new Date() },
        },
      }),
    ]);

    return res.json({
      cards,
      count: cards.length,
      stats: {
        reviewDue: totalReviewDue,
        newDue: totalNewDue,
        newCardsToday: firstReviewsToday,
        newCardsLimit: newCardsPerDay,
        remainingNewToday: remainingNewCardsToday,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/reviews/stats - Get review statistics
reviewRouter.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      reviewDue,
      newDue,
      totalCards,
      streak,
      recentReviews,
      settings,
      firstReviewsToday,
    ] = await Promise.all([
      // Review cards due (already seen)
      prisma.card.count({
        where: {
          userId,
          repetitions: { gt: 0 },
          nextReviewAt: { lte: new Date() },
        },
      }),
      // New cards available
      prisma.card.count({
        where: {
          userId,
          repetitions: 0,
          nextReviewAt: { lte: new Date() },
        },
      }),
      // Total cards
      prisma.card.count({
        where: { userId },
      }),
      // Streak
      prisma.streak.findUnique({
        where: { userId },
      }),
      // Recent reviews (last 7 days)
      prisma.review.count({
        where: {
          userId,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      // User settings
      prisma.userSettings.findUnique({
        where: { userId },
      }),
      // New cards introduced today
      prisma.review.count({
        where: {
          userId,
          createdAt: { gte: today },
          card: { repetitions: 1 },
        },
      }),
    ]);

    const newCardsPerDay = settings?.newCardsPerDay ?? 20;
    const remainingNewToday = Math.max(0, newCardsPerDay - firstReviewsToday);

    return res.json({
      // Due counts
      dueToday: reviewDue + Math.min(newDue, remainingNewToday),
      reviewDue,
      newDue,
      // New cards limit
      newCardsToday: firstReviewsToday,
      newCardsLimit: newCardsPerDay,
      remainingNewToday,
      // Totals
      totalCards,
      // Streak
      currentStreak: streak?.currentStreak || 0,
      longestStreak: streak?.longestStreak || 0,
      // Activity
      reviewsLast7Days: recentReviews,
    });
  } catch (error) {
    return next(error);
  }
});

// Validation schema for review submission
const submitReviewSchema = z.object({
  cardId: z.string(),
  rating: z.enum(['AGAIN', 'HARD', 'GOOD', 'EASY']),
  responseTime: z.number().optional(),
  sessionId: z.string().optional(),
  isPractice: z.boolean().optional(), // Practice mode - don't update SM-2 stats
});

// POST /api/reviews - Submit a review
reviewRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = submitReviewSchema.parse(req.body);

    // Verify card belongs to user
    const card = await prisma.card.findFirst({
      where: {
        id: data.cardId,
        userId: req.user!.id,
      },
    });

    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    // Practice mode - don't update SM-2 stats or streak
    if (data.isPractice) {
      return res.json({
        card,
        isPractice: true,
        message: 'Practice mode - no stats updated',
      });
    }

    // SM-2 Algorithm implementation
    const ratingValue = { AGAIN: 1, HARD: 2, GOOD: 3, EASY: 4 }[data.rating];

    let newEaseFactor = card.easeFactor;
    let newInterval = card.interval;
    let newRepetitions = card.repetitions;

    if (ratingValue < 3) {
      // Failed review - reset
      newRepetitions = 0;
      newInterval = 1;
    } else {
      // Successful review
      newRepetitions += 1;

      if (newRepetitions === 1) {
        newInterval = 1;
      } else if (newRepetitions === 2) {
        newInterval = 3;
      } else {
        newInterval = Math.round(card.interval * newEaseFactor);
      }

      // Update ease factor
      newEaseFactor = Math.max(
        1.3,
        card.easeFactor + (0.1 - (5 - ratingValue) * (0.08 + (5 - ratingValue) * 0.02))
      );

      // Bonus for easy
      if (data.rating === 'EASY') {
        newInterval = Math.round(newInterval * 1.3);
      }
    }

    const nextReviewAt = new Date();
    nextReviewAt.setDate(nextReviewAt.getDate() + newInterval);

    // Update card and create review in transaction
    const [updatedCard, review] = await prisma.$transaction([
      prisma.card.update({
        where: { id: card.id },
        data: {
          easeFactor: newEaseFactor,
          interval: newInterval,
          repetitions: newRepetitions,
          nextReviewAt,
        },
      }),
      prisma.review.create({
        data: {
          cardId: card.id,
          userId: req.user!.id,
          rating: data.rating as Rating,
          responseTime: data.responseTime,
          sessionId: data.sessionId,
        },
      }),
    ]);

    // Update streak and check for milestones
    const streakResult = await updateStreak(req.user!.id);

    return res.json({
      card: updatedCard,
      review,
      nextReviewIn: `${newInterval} day(s)`,
      streak: {
        current: streakResult.currentStreak,
        longest: streakResult.longestStreak,
        milestone: streakResult.milestone,
        isNewRecord: streakResult.isNewRecord,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }
    return next(error);
  }
});

// ============================================================================
// Practice Mode Endpoint
// ============================================================================

// POST /api/reviews/practice - Get ALL cards for a content (practice mode)
reviewRouter.post('/practice', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contentId } = req.body;

    if (!contentId) {
      return res.status(400).json({ error: 'contentId is required' });
    }

    const userId = req.user!.id;

    // Verify content belongs to user and has quizzes
    const content = await prisma.content.findFirst({
      where: {
        id: contentId,
        userId,
        status: 'READY',
      },
      include: {
        _count: { select: { quizzes: true } },
      },
    });

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    if (content._count.quizzes === 0) {
      return res.status(400).json({ error: 'Content has no quizzes' });
    }

    // Get ALL cards for this content (not just due ones)
    const cards = await prisma.card.findMany({
      where: {
        userId,
        quiz: {
          contentId,
        },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        quiz: {
          include: {
            content: {
              select: {
                id: true,
                title: true,
                url: true,
                platform: true,
              },
            },
          },
        },
      },
    });

    return res.json({
      cards,
      count: cards.length,
      content: {
        id: content.id,
        title: content.title,
        platform: content.platform,
      },
      isPractice: true,
    });
  } catch (error) {
    return next(error);
  }
});

// POST /api/reviews/practice/topic - Get ALL cards for a topic (mixed from all contents)
reviewRouter.post('/practice/topic', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { topicName } = req.body;

    if (!topicName) {
      return res.status(400).json({ error: 'topicName is required' });
    }

    const userId = req.user!.id;

    // Find all contents with this tag that belong to the user and are READY
    const contents = await prisma.content.findMany({
      where: {
        userId,
        status: 'READY',
        tags: {
          some: {
            name: topicName,
          },
        },
      },
      select: { id: true, title: true },
    });

    if (contents.length === 0) {
      return res.status(404).json({ error: 'No content found for this topic' });
    }

    const contentIds = contents.map(c => c.id);

    // Get ALL cards for these contents
    const cards = await prisma.card.findMany({
      where: {
        userId,
        quiz: {
          contentId: { in: contentIds },
        },
      },
      include: {
        quiz: {
          include: {
            content: {
              select: {
                id: true,
                title: true,
                url: true,
                platform: true,
              },
            },
          },
        },
      },
    });

    if (cards.length === 0) {
      return res.status(400).json({ error: 'No quizzes found for this topic' });
    }

    // Shuffle the cards randomly
    const shuffledCards = cards.sort(() => Math.random() - 0.5);

    return res.json({
      cards: shuffledCards,
      count: shuffledCards.length,
      topic: topicName,
      contentCount: contents.length,
      isPractice: true,
    });
  } catch (error) {
    return next(error);
  }
});

// POST /api/reviews/practice/theme - Get ALL cards for a theme (mixed from all contents)
reviewRouter.post('/practice/theme', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({ themeId: z.string() });
    const { themeId } = schema.parse(req.body);

    const userId = req.user!.id;

    // Verify theme ownership
    const theme = await prisma.theme.findFirst({
      where: { id: themeId, userId },
    });

    if (!theme) {
      return res.status(404).json({ error: 'Theme not found' });
    }

    // Find all READY contents in this theme that have quizzes
    const contents = await prisma.content.findMany({
      where: {
        userId,
        status: 'READY',
        contentThemes: {
          some: { themeId },
        },
        quizzes: {
          some: {},
        },
      },
      select: { id: true, title: true },
    });

    // Enforce minimum threshold
    if (contents.length < 3) {
      return res.status(400).json({
        error: 'Not enough content with quizzes',
        contentWithQuizzes: contents.length,
        minimum: 3,
      });
    }

    const contentIds = contents.map(c => c.id);

    // Get per-content cards (exclude synthesis)
    const cards = await prisma.card.findMany({
      where: {
        userId,
        quiz: {
          contentId: { in: contentIds },
          isSynthesis: false,
        },
      },
      include: {
        quiz: {
          include: {
            content: {
              select: {
                id: true,
                title: true,
                url: true,
                platform: true,
              },
            },
          },
        },
      },
    });

    // Get existing synthesis cards for this theme
    let synthesisCards = await prisma.card.findMany({
      where: {
        userId,
        quiz: { themeId, isSynthesis: true },
      },
      include: {
        quiz: {
          include: {
            theme: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Background synthesis generation if no synthesis cards exist (non-blocking)
    if (synthesisCards.length === 0) {
      // Fire-and-forget: generate synthesis in background for next quiz session
      (async () => {
        try {
          const contentWithMemos = await prisma.content.findMany({
            where: {
              id: { in: contentIds },
              transcript: { isNot: null },
            },
            include: { transcript: true },
            take: 15,
          });

          const contentMemos = contentWithMemos
            .filter(c => {
              const segments = c.transcript?.segments as any;
              return segments?.memo;
            })
            .map(c => ({
              id: c.id,
              title: c.title,
              memo: (c.transcript!.segments as any).memo as string,
            }));

          if (contentMemos.length >= 2) {
            const { generateSynthesisQuestions } = await import('../services/quizGeneration.js');
            const result = await generateSynthesisQuestions(theme.name, contentMemos, 5);

            if (result.questions.length > 0) {
              for (const q of result.questions) {
                const quiz = await prisma.quiz.create({
                  data: {
                    themeId,
                    contentId: null,
                    isSynthesis: true,
                    question: q.question,
                    type: 'MULTIPLE_CHOICE',
                    options: q.options,
                    correctAnswer: q.correctAnswer,
                    explanation: q.explanation,
                  },
                });
                await prisma.card.create({
                  data: { quizId: quiz.id, userId },
                });
              }
              console.log(`[synthesis] Generated ${result.questions.length} synthesis cards for theme ${themeId}`);
            }
          }
        } catch (err) {
          console.error(`[synthesis] Background generation failed for theme ${themeId}:`, err);
        }
      })();
    }

    // Mix: up to 5 synthesis + remaining per-content, total capped at 20
    const shuffledSynthesis = synthesisCards.sort(() => Math.random() - 0.5).slice(0, 5);
    const remainingSlots = 20 - shuffledSynthesis.length;
    const shuffledContent = cards.sort(() => Math.random() - 0.5).slice(0, remainingSlots);
    const cappedCards = [...shuffledContent, ...shuffledSynthesis].sort(() => Math.random() - 0.5);

    return res.json({
      cards: cappedCards,
      count: cappedCards.length,
      theme: { id: theme.id, name: theme.name, emoji: theme.emoji },
      contentCount: contents.length,
      hasSynthesis: shuffledSynthesis.length > 0,
      synthesisCount: shuffledSynthesis.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }
    return next(error);
  }
});

// ============================================================================
// Quiz Session Endpoints
// ============================================================================

// Validation schema for session creation
const createSessionSchema = z.object({
  questionLimit: z.number().min(1).max(100).nullable().optional(),
  platforms: z.array(z.enum(['YOUTUBE', 'SPOTIFY', 'TIKTOK'])).optional(),
  tagIds: z.array(z.string()).optional(),
  contentIds: z.array(z.string()).optional(),
  mode: z.enum(['due', 'practice']).optional().default('practice'), // 'practice' = all cards, 'due' = only due cards
});

// POST /api/reviews/session - Create a new quiz session
reviewRouter.post('/session', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createSessionSchema.parse(req.body);
    const userId = req.user!.id;
    const mode = data.mode || 'practice'; // Default to practice mode (all cards)

    // Create session with mode
    const session = await prisma.quizSession.create({
      data: {
        userId,
        questionLimit: data.questionLimit ?? null,
        platforms: data.platforms as Platform[] || [],
        tagIds: data.tagIds || [],
        contentIds: data.contentIds || [],
        mode, // Store mode in session
      },
    });

    // Get matching cards count (pass mode to determine if we filter by nextReviewAt)
    const sessionConfig = { ...session, mode };
    const matchingCards = await getSessionCards(userId, sessionConfig, true);

    return res.status(201).json({
      session: { ...session, mode },
      matchingCardsCount: matchingCards,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }
    return next(error);
  }
});

// GET /api/reviews/session/preview - Preview matching cards without creating session
reviewRouter.get('/session/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { platforms, tagIds, contentIds } = req.query;

    const config = {
      platforms: platforms ? (platforms as string).split(',').filter(Boolean) as Platform[] : [],
      tagIds: tagIds ? (tagIds as string).split(',').filter(Boolean) : [],
      contentIds: contentIds ? (contentIds as string).split(',').filter(Boolean) : [],
    };

    const count = await getSessionCards(userId, config, true);

    return res.json({ matchingCardsCount: count });
  } catch (error) {
    return next(error);
  }
});

// GET /api/reviews/sessions - Get all completed quiz sessions
reviewRouter.get('/sessions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const limit = Math.min(parseInt(asString(req.query.limit as string) || '50'), 100);
    const offset = parseInt(asString(req.query.offset as string) || '0');

    const sessions = await prisma.quizSession.findMany({
      where: {
        userId,
        completedAt: { not: null },
      },
      orderBy: { completedAt: 'desc' },
      skip: offset,
      take: limit,
      include: {
        reviews: {
          include: {
            card: {
              include: {
                quiz: {
                  include: {
                    content: {
                      select: {
                        id: true,
                        title: true,
                        platform: true,
                        thumbnailUrl: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const items = sessions.map(session => {
      // Extract unique contents
      const contentMap = new Map<string, { id: string; title: string; platform: string; thumbnailUrl: string | null }>();
      for (const review of session.reviews) {
        const content = review.card.quiz.content;
        if (!content) continue;
        if (!contentMap.has(content.id)) {
          contentMap.set(content.id, content);
        }
      }

      const totalCount = session.totalCount ?? session.reviews.length;
      const correctCount = session.correctCount ?? 0;
      const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

      return {
        id: session.id,
        completedAt: session.completedAt,
        totalCount,
        correctCount,
        accuracy,
        hasMemo: !!session.aiMemo,
        contents: Array.from(contentMap.values()),
      };
    });

    return res.json({ sessions: items });
  } catch (error) {
    return next(error);
  }
});

// GET /api/reviews/session/:id - Get session details
reviewRouter.get('/session/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = asString(req.params.id);
    const session = await prisma.quizSession.findFirst({
      where: {
        id: sessionId,
        userId: req.user!.id,
      },
      include: {
        reviews: {
          include: {
            card: {
              include: {
                quiz: true,
              },
            },
          },
        },
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    return res.json(session);
  } catch (error) {
    return next(error);
  }
});

// GET /api/reviews/session/:id/cards - Get cards for a session
reviewRouter.get('/session/:id/cards', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const sessionId = asString(req.params.id);

    const session = await prisma.quizSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Pass mode to getSessionCards (default to 'practice' if not set)
    const sessionConfig = { ...session, mode: (session as any).mode || 'practice' };
    const cards = await getSessionCards(userId, sessionConfig, false);

    return res.json({
      cards,
      count: Array.isArray(cards) ? cards.length : 0,
      session,
      mode: sessionConfig.mode,
    });
  } catch (error) {
    return next(error);
  }
});

// POST /api/reviews/session/:id/complete - Mark session as complete
reviewRouter.post('/session/:id/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = asString(req.params.id);
    const session = await prisma.quizSession.findFirst({
      where: {
        id: sessionId,
        userId: req.user!.id,
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.completedAt) {
      return res.status(400).json({ error: 'Session already completed' });
    }

    // Count reviews in this session
    const reviewStats = await prisma.review.groupBy({
      by: ['rating'],
      where: { sessionId: session.id },
      _count: true,
    });

    const totalCount = reviewStats.reduce((sum, r) => sum + r._count, 0);
    const correctCount = reviewStats
      .filter(r => r.rating === 'GOOD' || r.rating === 'EASY')
      .reduce((sum, r) => sum + r._count, 0);

    const updatedSession = await prisma.quizSession.update({
      where: { id: session.id },
      data: {
        completedAt: new Date(),
        totalCount,
        correctCount,
      },
    });

    return res.json({
      session: updatedSession,
      stats: {
        totalCount,
        correctCount,
        accuracy: totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// POST /api/reviews/session/:id/memo - Generate AI memo for session
reviewRouter.post('/session/:id/memo', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = asString(req.params.id);
    const session = await prisma.quizSession.findFirst({
      where: {
        id: sessionId,
        userId: req.user!.id,
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!session.completedAt) {
      return res.status(400).json({ error: 'Session not completed yet' });
    }

    const forceRegenerate = req.body.force === true;

    // If memo already generated and not forcing, return it
    if (session.aiMemo && !forceRegenerate) {
      return res.json({ memo: session.aiMemo, generatedAt: session.memoGeneratedAt });
    }

    // Get all reviewed content from this session
    const reviews = await prisma.review.findMany({
      where: { sessionId: session.id },
      include: {
        card: {
          include: {
            quiz: {
              include: {
                content: {
                  select: {
                    id: true,
                    title: true,
                    platform: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (reviews.length === 0) {
      return res.status(400).json({ error: 'No reviews in this session' });
    }

    // Collect unique content, questions, and performance data
    const contentMap = new Map<string, { title: string; platform: string; correct: string[]; incorrect: string[] }>();

    let correctCount = 0;
    let incorrectCount = 0;

    for (const review of reviews) {
      const content = review.card.quiz.content;
      if (!content) continue; // Skip synthesis questions (no content link)
      if (!contentMap.has(content.id)) {
        contentMap.set(content.id, {
          title: content.title,
          platform: content.platform,
          correct: [],
          incorrect: [],
        });
      }
      const isCorrect = review.rating === 'GOOD' || review.rating === 'EASY';
      if (isCorrect) {
        contentMap.get(content.id)!.correct.push(review.card.quiz.question);
        correctCount++;
      } else {
        contentMap.get(content.id)!.incorrect.push(review.card.quiz.question);
        incorrectCount++;
      }
    }

    // Build prompt with performance-aware context
    const contentSummary = Array.from(contentMap.values())
      .map(c => {
        let summary = `- ${c.title} (${c.platform})`;
        if (c.correct.length > 0) {
          summary += `\n  Maîtrisé: ${c.correct.slice(0, 2).join('; ')}`;
        }
        if (c.incorrect.length > 0) {
          summary += `\n  À revoir: ${c.incorrect.slice(0, 2).join('; ')}`;
        }
        return summary;
      })
      .join('\n');

    const systemPrompt = `Tu es un expert en sciences cognitives. Tu génères des mémos post-révision basés sur le principe du "retrieval practice" (Roediger & Butler, 2011): renforcer ce qui a été difficile et consolider ce qui est acquis.

Ton mémo doit:
- Commencer par les concepts que l'utilisateur a eu du mal à retenir (priorité aux lacunes)
- Puis consolider les points bien maîtrisés avec un rappel synthétique
- Utiliser des bullet points avec tirets (-)
- Maximum 200 mots, entièrement en français
- Être directement actionnable (pas de phrases creuses)`;

    const userPrompt = `Session terminée: ${reviews.length} questions (${correctCount} correctes, ${incorrectCount} incorrectes).

Contenu révisé:
${contentSummary}

Génère un mémo post-révision qui:
1. Identifie les points faibles à retravailler en priorité (basé sur les réponses incorrectes)
2. Résume les concepts bien acquis pour consolidation
3. Suggère un angle de révision pour la prochaine session`;

    const memo = await generateText(userPrompt, { system: systemPrompt, temperature: 0.5 });

    // Save memo to session
    await prisma.quizSession.update({
      where: { id: session.id },
      data: {
        aiMemo: memo,
        memoGeneratedAt: new Date(),
      },
    });

    return res.json({ memo, generatedAt: new Date() });
  } catch (error) {
    return next(error);
  }
});

// GET /api/reviews/session/:id/mistakes - Get questions answered incorrectly
reviewRouter.get('/session/:id/mistakes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = asString(req.params.id);
    const session = await prisma.quizSession.findFirst({
      where: {
        id: sessionId,
        userId: req.user!.id,
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get reviews where user struggled (AGAIN or HARD)
    const mistakes = await prisma.review.findMany({
      where: {
        sessionId: session.id,
        rating: { in: ['AGAIN', 'HARD'] },
      },
      include: {
        card: {
          include: {
            quiz: {
              include: {
                content: {
                  select: {
                    id: true,
                    title: true,
                    platform: true,
                    url: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return res.json({
      mistakes: mistakes.map(m => ({
        id: m.id,
        rating: m.rating,
        question: m.card.quiz.question,
        options: m.card.quiz.options,
        correctAnswer: m.card.quiz.correctAnswer,
        explanation: m.card.quiz.explanation,
        content: m.card.quiz.content,
      })),
      count: mistakes.length,
    });
  } catch (error) {
    return next(error);
  }
});

// Helper function to get cards matching session filters
async function getSessionCards(
  userId: string,
  config: { platforms: Platform[]; tagIds: string[]; contentIds: string[]; questionLimit?: number | null; mode?: string },
  countOnly: true
): Promise<number>;
async function getSessionCards(
  userId: string,
  config: { platforms: Platform[]; tagIds: string[]; contentIds: string[]; questionLimit?: number | null; mode?: string },
  countOnly: false
): Promise<any[]>;
async function getSessionCards(
  userId: string,
  config: { platforms: Platform[]; tagIds: string[]; contentIds: string[]; questionLimit?: number | null; mode?: string },
  countOnly: boolean
): Promise<number | any[]> {
  const mode = config.mode || 'practice'; // Default to practice mode

  // Build content filter
  const contentWhere: any = {
    userId,
    status: 'READY',
  };

  if (config.platforms && config.platforms.length > 0) {
    contentWhere.platform = { in: config.platforms };
  }

  // Only apply contentIds filter if array is not empty
  if (config.contentIds && config.contentIds.length > 0) {
    contentWhere.id = { in: config.contentIds };
  }

  if (config.tagIds && config.tagIds.length > 0) {
    contentWhere.tags = {
      some: {
        id: { in: config.tagIds },
      },
    };
  }

  // Build card filter
  const cardWhere: any = {
    userId,
    quiz: {
      content: contentWhere,
    },
  };

  // Only filter by nextReviewAt in 'due' mode (spaced repetition)
  // In 'practice' mode, return ALL cards regardless of schedule
  if (mode === 'due') {
    cardWhere.nextReviewAt = { lte: new Date() };
  }

  if (countOnly) {
    return prisma.card.count({ where: cardWhere });
  }

  const limit = config.questionLimit ?? 50;

  // In practice mode, randomize order; in due mode, show oldest first
  const orderBy = mode === 'practice'
    ? { createdAt: 'asc' as const }  // Show in creation order for practice
    : { nextReviewAt: 'asc' as const };  // Show most due first for review

  return prisma.card.findMany({
    where: cardWhere,
    orderBy,
    take: limit,
    include: {
      quiz: {
        include: {
          content: {
            select: {
              id: true,
              title: true,
              url: true,
              platform: true,
              tags: true,
            },
          },
        },
      },
    },
  });
}

// GET /api/reviews/settings - Get review settings
reviewRouter.get('/settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.userSettings.findUnique({
      where: { userId: req.user!.id },
    });

    return res.json({
      newCardsPerDay: settings?.newCardsPerDay ?? 20,
      dailyReminderTime: settings?.dailyReminderTime ?? '09:00',
      timezone: settings?.timezone ?? 'UTC',
      emailReminders: settings?.emailReminders ?? true,
    });
  } catch (error) {
    return next(error);
  }
});

// Validation schema for settings update
const updateSettingsSchema = z.object({
  newCardsPerDay: z.number().min(0).max(100).optional(),
  dailyReminderTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  timezone: z.string().optional(),
  emailReminders: z.boolean().optional(),
});

// PATCH /api/reviews/settings - Update review settings
reviewRouter.patch('/settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateSettingsSchema.parse(req.body);

    const settings = await prisma.userSettings.upsert({
      where: { userId: req.user!.id },
      update: data,
      create: {
        userId: req.user!.id,
        ...data,
      },
    });

    return res.json(settings);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }
    return next(error);
  }
});

// GET /api/reviews/memos - Get all sessions with memos
reviewRouter.get('/memos', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessions = await prisma.quizSession.findMany({
      where: {
        userId: req.user!.id,
        aiMemo: { not: null },
      },
      orderBy: { completedAt: 'desc' },
      include: {
        reviews: {
          include: {
            card: {
              include: {
                quiz: {
                  include: {
                    content: {
                      select: {
                        id: true,
                        title: true,
                        platform: true,
                        thumbnailUrl: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Format response with content info
    const memos = sessions.map(session => {
      // Get unique contents from this session
      const contentMap = new Map<string, { id: string; title: string; platform: string; thumbnailUrl: string | null }>();
      for (const review of session.reviews) {
        const content = review.card.quiz.content;
        if (!content) continue; // Skip synthesis questions
        if (!contentMap.has(content.id)) {
          contentMap.set(content.id, content);
        }
      }

      return {
        id: session.id,
        memo: session.aiMemo,
        createdAt: session.memoGeneratedAt || session.completedAt,
        questionsCount: session.reviews.length,
        contents: Array.from(contentMap.values()),
      };
    });

    return res.json({ memos });
  } catch (error) {
    return next(error);
  }
});

// Milestone thresholds for streak celebrations
const STREAK_MILESTONES = [7, 14, 30, 60, 100, 180, 365];

interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  milestone: number | null;  // Non-null if user just hit a milestone
  isNewRecord: boolean;      // True if this is a new personal best
}

// Helper function to update streak and return milestone info
async function updateStreak(userId: string): Promise<StreakResult> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const streak = await prisma.streak.findUnique({
    where: { userId },
  });

  if (!streak) {
    // Create new streak
    await prisma.streak.create({
      data: {
        userId,
        currentStreak: 1,
        longestStreak: 1,
        lastReviewDate: today,
      },
    });
    return { currentStreak: 1, longestStreak: 1, milestone: null, isNewRecord: true };
  }

  const lastReview = streak.lastReviewDate;
  if (!lastReview) {
    // First review
    await prisma.streak.update({
      where: { userId },
      data: {
        currentStreak: 1,
        longestStreak: Math.max(1, streak.longestStreak),
        lastReviewDate: today,
      },
    });
    return {
      currentStreak: 1,
      longestStreak: Math.max(1, streak.longestStreak),
      milestone: null,
      isNewRecord: streak.longestStreak === 0,
    };
  }

  const lastReviewDay = new Date(lastReview);
  lastReviewDay.setHours(0, 0, 0, 0);

  const daysDiff = Math.floor((today.getTime() - lastReviewDay.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff === 0) {
    // Same day, no streak change
    return {
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      milestone: null,
      isNewRecord: false,
    };
  } else if (daysDiff === 1) {
    // Consecutive day, increment streak
    const newStreak = streak.currentStreak + 1;
    const newLongest = Math.max(newStreak, streak.longestStreak);
    const isNewRecord = newStreak > streak.longestStreak;

    await prisma.streak.update({
      where: { userId },
      data: {
        currentStreak: newStreak,
        longestStreak: newLongest,
        lastReviewDate: today,
      },
    });

    // Check if user hit a milestone
    const milestone = STREAK_MILESTONES.includes(newStreak) ? newStreak : null;

    return {
      currentStreak: newStreak,
      longestStreak: newLongest,
      milestone,
      isNewRecord,
    };
  } else {
    // Streak broken
    await prisma.streak.update({
      where: { userId },
      data: {
        currentStreak: 1,
        lastReviewDate: today,
      },
    });
    return {
      currentStreak: 1,
      longestStreak: streak.longestStreak,
      milestone: null,
      isNewRecord: false,
    };
  }
}
