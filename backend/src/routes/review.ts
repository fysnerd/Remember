import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { Rating } from '@prisma/client';

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
