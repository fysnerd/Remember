import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { Rating, Platform } from '@prisma/client';
import { generateText } from '../services/llm.js';

export const reviewRouter = Router();

// All review routes require authentication
reviewRouter.use(authenticateToken);

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
// Quiz Session Endpoints
// ============================================================================

// Validation schema for session creation
const createSessionSchema = z.object({
  questionLimit: z.number().min(1).max(100).nullable().optional(),
  platforms: z.array(z.enum(['YOUTUBE', 'SPOTIFY', 'TIKTOK'])).optional(),
  tagIds: z.array(z.string()).optional(),
  contentIds: z.array(z.string()).optional(),
});

// POST /api/reviews/session - Create a new quiz session
reviewRouter.post('/session', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createSessionSchema.parse(req.body);
    const userId = req.user!.id;

    // Create session
    const session = await prisma.quizSession.create({
      data: {
        userId,
        questionLimit: data.questionLimit ?? null,
        platforms: data.platforms as Platform[] || [],
        tagIds: data.tagIds || [],
        contentIds: data.contentIds || [],
      },
    });

    // Get matching cards count
    const matchingCards = await getSessionCards(userId, session, true);

    return res.status(201).json({
      session,
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

// GET /api/reviews/session/:id - Get session details
reviewRouter.get('/session/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await prisma.quizSession.findFirst({
      where: {
        id: req.params.id,
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

    const session = await prisma.quizSession.findFirst({
      where: {
        id: req.params.id,
        userId,
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const cards = await getSessionCards(userId, session, false);

    return res.json({
      cards,
      count: Array.isArray(cards) ? cards.length : 0,
      session,
    });
  } catch (error) {
    return next(error);
  }
});

// POST /api/reviews/session/:id/complete - Mark session as complete
reviewRouter.post('/session/:id/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await prisma.quizSession.findFirst({
      where: {
        id: req.params.id,
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
    const session = await prisma.quizSession.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id,
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!session.completedAt) {
      return res.status(400).json({ error: 'Session not completed yet' });
    }

    // If memo already generated, return it
    if (session.aiMemo) {
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

    // Collect unique content and questions reviewed
    const contentMap = new Map<string, { title: string; platform: string; questions: string[] }>();

    for (const review of reviews) {
      const content = review.card.quiz.content;
      if (!contentMap.has(content.id)) {
        contentMap.set(content.id, {
          title: content.title,
          platform: content.platform,
          questions: [],
        });
      }
      contentMap.get(content.id)!.questions.push(review.card.quiz.question);
    }

    // Build prompt for memo generation
    const contentSummary = Array.from(contentMap.values())
      .map(c => `- ${c.title} (${c.platform})\n  Questions: ${c.questions.slice(0, 3).join('; ')}${c.questions.length > 3 ? '...' : ''}`)
      .join('\n');

    const systemPrompt = `You are a learning assistant. Generate a concise study memo summarizing the key concepts the user just reviewed. Focus on 3-5 main takeaways that would help them remember the material. Be practical and actionable. Use bullet points.`;

    const userPrompt = `The user just completed a review session with ${reviews.length} questions from the following content:

${contentSummary}

Generate a brief memo (max 200 words) with the main takeaways and concepts to remember.`;

    const memo = await generateText(userPrompt, { system: systemPrompt, temperature: 0.7 });

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
    const session = await prisma.quizSession.findFirst({
      where: {
        id: req.params.id,
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
  config: { platforms: Platform[]; tagIds: string[]; contentIds: string[]; questionLimit?: number | null },
  countOnly: true
): Promise<number>;
async function getSessionCards(
  userId: string,
  config: { platforms: Platform[]; tagIds: string[]; contentIds: string[]; questionLimit?: number | null },
  countOnly: false
): Promise<any[]>;
async function getSessionCards(
  userId: string,
  config: { platforms: Platform[]; tagIds: string[]; contentIds: string[]; questionLimit?: number | null },
  countOnly: boolean
): Promise<number | any[]> {
  // Build content filter
  const contentWhere: any = {
    userId,
    status: 'READY',
  };

  if (config.platforms && config.platforms.length > 0) {
    contentWhere.platform = { in: config.platforms };
  }

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
    nextReviewAt: { lte: new Date() },
    quiz: {
      content: contentWhere,
    },
  };

  if (countOnly) {
    return prisma.card.count({ where: cardWhere });
  }

  const limit = config.questionLimit ?? 50;

  return prisma.card.findMany({
    where: cardWhere,
    orderBy: { nextReviewAt: 'asc' },
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
