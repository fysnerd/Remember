// RevenueCat Webhook Service
// Handles subscription lifecycle events from RevenueCat → updates user plan in DB
import { prisma } from '../config/database.js';
import { Plan } from '@prisma/client';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';

const log = logger.child({ service: 'revenuecat' });

// Product ID → Plan mapping (must match RevenueCat dashboard)
const PRODUCT_PLAN_MAP: Record<string, Plan> = {
  monthly: Plan.PRO,
  yearly: Plan.PRO,
  lifetime: Plan.LIFETIME,
};

interface RevenueCatEvent {
  type: string;
  app_user_id: string;
  aliases?: string[];
  product_id?: string;
  entitlement_ids?: string[];
  period_type?: string;
  purchased_at_ms?: number;
  expiration_at_ms?: number;
  environment?: string;
  store?: string;
}

interface RevenueCatWebhookPayload {
  api_version: string;
  event: RevenueCatEvent;
}

/**
 * Verify webhook authorization header matches our secret.
 */
export function verifyWebhookAuth(authHeader: string | undefined): boolean {
  if (!config.revenuecat.webhookSecret) return false;
  if (!authHeader) return false;
  const token = authHeader.replace(/^Bearer\s+/i, '');
  return token === config.revenuecat.webhookSecret;
}

/**
 * Resolve a Prisma user from RC's app_user_id or aliases.
 * Returns null if the user can't be found (e.g. anonymous RC user).
 */
async function resolveUser(event: RevenueCatEvent) {
  const { app_user_id, aliases } = event;

  // Skip anonymous RevenueCat users
  if (app_user_id.startsWith('$RCAnonymousID:')) {
    log.debug({ app_user_id }, 'Skipping anonymous RC user');
    return null;
  }

  // Try primary app_user_id first
  let user = await prisma.user.findUnique({ where: { id: app_user_id } });
  if (user) return user;

  // Try aliases
  if (aliases?.length) {
    for (const alias of aliases) {
      if (alias.startsWith('$RCAnonymousID:')) continue;
      user = await prisma.user.findUnique({ where: { id: alias } });
      if (user) return user;
    }
  }

  log.warn({ app_user_id, aliases }, 'Could not resolve RC user to a DB user');
  return null;
}

/**
 * Handle a RevenueCat webhook event.
 */
export async function handleRevenueCatWebhook(
  payload: RevenueCatWebhookPayload
): Promise<{ success: boolean; message: string }> {
  const { event } = payload;

  log.info(
    { type: event.type, app_user_id: event.app_user_id, product_id: event.product_id, environment: event.environment },
    'RevenueCat webhook received'
  );

  const user = await resolveUser(event);
  if (!user) {
    // Not an error — anonymous users or test events
    return { success: true, message: 'User not found, skipped' };
  }

  const productId = event.product_id || '';
  const targetPlan = PRODUCT_PLAN_MAP[productId];

  switch (event.type) {
    // === PURCHASE / RENEWAL → upgrade ===
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'UNCANCELLATION':
    case 'SUBSCRIPTION_EXTENDED': {
      if (!targetPlan) {
        log.warn({ productId }, 'Unknown product ID, cannot determine plan');
        return { success: true, message: `Unknown product: ${productId}` };
      }
      // LIFETIME is never downgraded
      if (user.plan === Plan.LIFETIME && targetPlan !== Plan.LIFETIME) {
        log.info({ userId: user.id }, 'User is LIFETIME, ignoring non-lifetime event');
        return { success: true, message: 'LIFETIME user, no change' };
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { plan: targetPlan },
      });
      log.info({ userId: user.id, plan: targetPlan, productId }, 'User plan upgraded');
      break;
    }

    // === LIFETIME one-time purchase ===
    case 'NON_RENEWING_PURCHASE': {
      await prisma.user.update({
        where: { id: user.id },
        data: { plan: Plan.LIFETIME },
      });
      log.info({ userId: user.id }, 'User plan set to LIFETIME');
      break;
    }

    // === EXPIRATION → downgrade (only if not LIFETIME) ===
    case 'EXPIRATION': {
      if (user.plan === Plan.LIFETIME) {
        log.info({ userId: user.id }, 'LIFETIME user, ignoring expiration');
        return { success: true, message: 'LIFETIME never expires' };
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { plan: Plan.FREE },
      });
      log.info({ userId: user.id }, 'User plan downgraded to FREE (subscription expired)');
      break;
    }

    // === CANCELLATION → log only, access continues until expiration ===
    case 'CANCELLATION': {
      log.info(
        { userId: user.id, expiration: event.expiration_at_ms },
        'Subscription cancelled — access continues until expiration'
      );
      // Do NOT downgrade now — EXPIRATION event will handle it
      break;
    }

    // === BILLING ISSUE → log warning ===
    case 'BILLING_ISSUE_DETECTED': {
      log.warn({ userId: user.id, productId }, 'Billing issue detected — RC will retry');
      break;
    }

    // === PRODUCT CHANGE (e.g. monthly → yearly) ===
    case 'PRODUCT_CHANGE': {
      if (!targetPlan) {
        log.warn({ productId }, 'Unknown product ID on product change');
        return { success: true, message: `Unknown product: ${productId}` };
      }
      if (user.plan === Plan.LIFETIME) {
        log.info({ userId: user.id }, 'LIFETIME user, ignoring product change');
        return { success: true, message: 'LIFETIME user, no change' };
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { plan: targetPlan },
      });
      log.info({ userId: user.id, plan: targetPlan, productId }, 'User plan updated (product change)');
      break;
    }

    // === PAUSE ===
    case 'SUBSCRIPTION_PAUSED': {
      if (user.plan === Plan.LIFETIME) {
        return { success: true, message: 'LIFETIME never paused' };
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { plan: Plan.FREE },
      });
      log.info({ userId: user.id }, 'User plan set to FREE (subscription paused)');
      break;
    }

    default:
      log.debug({ type: event.type }, 'Unhandled RevenueCat event type');
  }

  return { success: true, message: `Processed ${event.type}` };
}
