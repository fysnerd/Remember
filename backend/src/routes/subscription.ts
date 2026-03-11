// Subscription routes (S019)
import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  createCheckoutSession,
  createPortalSession,
  getSubscriptionStatus,
  handleStripeWebhook,
} from '../services/stripe.js';
import { verifyWebhookAuth, handleRevenueCatWebhook } from '../services/revenuecat.js';
import { logger } from '../config/logger.js';

const log = logger.child({ route: 'subscription' });

export const subscriptionRouter = Router();

// GET /api/subscription/status - Get current subscription status
subscriptionRouter.get('/status', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await getSubscriptionStatus(req.user!.id);
    return res.json(status);
  } catch (error) {
    return next(error);
  }
});

// POST /api/subscription/checkout - Create checkout session
subscriptionRouter.post('/checkout', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { priceType } = req.body;

    if (!priceType || !['monthly', 'yearly'].includes(priceType)) {
      return res.status(400).json({ error: 'Invalid price type. Must be "monthly" or "yearly"' });
    }

    const result = await createCheckoutSession(req.user!.id, priceType);

    if ('error' in result) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({ url: result.url });
  } catch (error) {
    return next(error);
  }
});

// POST /api/subscription/portal - Create customer portal session
subscriptionRouter.post('/portal', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await createPortalSession(req.user!.id);

    if ('error' in result) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({ url: result.url });
  } catch (error) {
    return next(error);
  }
});

// POST /api/subscription/webhook - Stripe webhook endpoint (no auth)
subscriptionRouter.post(
  '/webhook',
  // Note: This route needs raw body, configure in server.ts
  async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'];

    if (!signature || typeof signature !== 'string') {
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    // Get raw body - must be configured in server.ts to preserve raw body
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      return res.status(400).json({ error: 'Raw body not available' });
    }

    const result = await handleStripeWebhook(rawBody, signature);

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    return res.json({ received: true });
  }
);

// POST /api/subscription/revenuecat-webhook - RevenueCat webhook endpoint (no user auth)
subscriptionRouter.post('/revenuecat-webhook', async (req: Request, res: Response) => {
  // Verify webhook secret via Authorization header
  const authHeader = req.headers.authorization;
  if (!verifyWebhookAuth(authHeader as string | undefined)) {
    log.warn('RevenueCat webhook: unauthorized request');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await handleRevenueCatWebhook(req.body);
    return res.status(200).json(result);
  } catch (error) {
    log.error({ err: error }, 'RevenueCat webhook processing error');
    return res.status(500).json({ error: 'Internal server error' });
  }
});
