import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { logger } from '../config/logger.js';

const log = logger.child({ route: 'onboarding' });

export const onboardingRouter = Router();

// All onboarding routes require auth
onboardingRouter.use(authenticateToken);

// Map reviewPace to newCardsPerDay
const paceToCards: Record<string, number> = {
  '1-2/sem': 5,
  '3-5/sem': 10,
  '1/jour': 20,
  'plusieurs/jour': 40,
};

const stepSchema = z.object({
  step: z.number().int().min(1).max(11),
  data: z.record(z.unknown()).optional(),
});

// POST /api/onboarding/step
onboardingRouter.post('/step', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { step, data } = stepSchema.parse(req.body);
    const userId = req.user!.id;

    // Process step-specific data
    switch (step) {
      case 1: {
        // Name step — save firstName
        const name = data?.name as string | undefined;
        if (name) {
          await prisma.user.update({
            where: { id: userId },
            data: { name },
          });
        }
        break;
      }

      case 3: {
        // Interests
        const interests = data?.interests as string[] | undefined;
        if (interests?.length) {
          await prisma.userSettings.upsert({
            where: { userId },
            update: { interests },
            create: { userId, interests },
          });
        }
        break;
      }

      case 4: {
        // Objective
        const objective = data?.objective as string | undefined;
        if (objective) {
          await prisma.userSettings.upsert({
            where: { userId },
            update: { objective },
            create: { userId, objective },
          });
        }
        break;
      }

      case 5: {
        // Review pace
        const reviewPace = data?.reviewPace as string | undefined;
        if (reviewPace) {
          const newCardsPerDay = paceToCards[reviewPace] ?? 20;
          await prisma.userSettings.upsert({
            where: { userId },
            update: { reviewPace, newCardsPerDay },
            create: { userId, reviewPace, newCardsPerDay },
          });
        }
        break;
      }

      case 7: {
        // Attribution source
        const attributionSource = data?.attributionSource as string[] | undefined;
        if (attributionSource?.length) {
          await prisma.user.update({
            where: { id: userId },
            data: { attributionSource },
          });
        }
        break;
      }

      // Steps 2, 6, 8, 9, 10, 11 — just advance the step
      default:
        break;
    }

    // Always update onboardingStep
    await prisma.user.update({
      where: { id: userId },
      data: { onboardingStep: step },
    });

    log.info({ userId, step }, 'Onboarding step saved');
    return res.json({ success: true, step });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    return next(error);
  }
});

// POST /api/onboarding/complete
onboardingRouter.post('/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    await prisma.user.update({
      where: { id: userId },
      data: { onboardingCompleted: true },
    });

    log.info({ userId }, 'Onboarding completed');
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});
