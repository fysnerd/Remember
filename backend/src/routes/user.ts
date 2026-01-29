import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

export const userRouter = Router();

// All user routes require authentication
userRouter.use(authenticateToken);

// Validation schema
const updateSettingsSchema = z.object({
  dailyReminderTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  timezone: z.string().optional(),
  newCardsPerDay: z.number().min(1).max(100).optional(),
  emailReminders: z.boolean().optional(),
});

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

// GET /api/users/settings
userRouter.get('/settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.userSettings.findUnique({
      where: { userId: req.user!.id },
    });

    if (!settings) {
      // Create default settings if not exists
      const newSettings = await prisma.userSettings.create({
        data: { userId: req.user!.id },
      });
      return res.json(newSettings);
    }

    return res.json(settings);
  } catch (error) {
    return next(error);
  }
});

// PATCH /api/users/settings
userRouter.patch('/settings', async (req: Request, res: Response, next: NextFunction) => {
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

// PATCH /api/users/profile
userRouter.patch('/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateProfileSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        plan: true,
        trialEndsAt: true,
      },
    });

    return res.json(user);
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

// DELETE /api/users/account - Delete user account (GDPR)
userRouter.delete('/account', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // This will cascade delete all user data due to onDelete: Cascade
    await prisma.user.delete({
      where: { id: req.user!.id },
    });

    return res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    return next(error);
  }
});
