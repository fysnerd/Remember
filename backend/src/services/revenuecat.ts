// RevenueCat Webhook Handler
// Docs: https://www.revenuecat.com/docs/integrations/webhooks
import { prisma } from '../config/database.js';
import { config } from '../config/env.js';
import { Plan } from '@prisma/client';
import { logger } from '../config/logger.js';

const log = logger.child({ service: 'revenuecat' });

// RevenueCat event types
type RevenueCatEventType =
  | 'INITIAL_PURCHASE'
  | 'RENEWAL'
  | 'CANCELLATION'
  | 'UNCANCELLATION'
  | 'PRODUCT_CHANGE'
  | 'EXPIRATION'
  | 'BILLING_ISSUE'
  | 'SUBSCRIBER_ALIAS'
  | 'TRANSFER'
  | 'NON_RENEWING_PURCHASE'
  | 'SUBSCRIPTION_PAUSED'
  | 'SUBSCRIPTION_EXTENDED';

interface RevenueCatEvent {
  type: RevenueCatEventType;
  id: string;
  app_user_id: string;
  aliases?: string[];
  product_id?: string;
  entitlement_ids?: string[];
  period_type?: string;
  purchased_at_ms?: number;
  expiration_at_ms?: number;
  environment?: 'PRODUCTION' | 'SANDBOX';
  store?: string;
  price?: number;
  currency?: string;
  offer_code?: string | null;
}

interface RevenueCatWebhookPayload {
  api_version: string;
  event: RevenueCatEvent;
}

/**
 * Verify the RevenueCat webhook Authorization header.
 * RevenueCat sends the exact value configured in the dashboard as Authorization header.
 * We compare the full header value (or just the Bearer token) against our secret.
 */
export function verifyRevenueCatWebhook(authHeader: string | undefined): boolean {
  if (!config.revenuecat.webhookSecret) {
    log.warn('REVENUECAT_WEBHOOK_SECRET not configured — rejecting webhook');
    return false;
  }
  if (!authHeader) return false;

  // Support both "Bearer <secret>" and raw "<secret>" formats
  const token = authHeader.replace(/^Bearer\s+/i, '');
  return token === config.revenuecat.webhookSecret;
}

/**
 * Handle a RevenueCat webhook event.
 * Updates user plan in DB based on entitlement changes.
 */
export async function handleRevenueCatWebhook(
  payload: RevenueCatWebhookPayload
): Promise<{ success: boolean; message: string }> {
  const { event } = payload;

  log.info(
    { eventType: event.type, appUserId: event.app_user_id, productId: event.product_id, environment: event.environment },
    'RevenueCat webhook received'
  );

  // Skip sandbox events in production (optional — keep for now to test)
  // if (config.isProduction && event.environment === 'SANDBOX') {
  //   log.debug('Skipping sandbox event in production');
  //   return { success: true, message: 'Sandbox event skipped' };
  // }

  const userId = event.app_user_id;

  // Skip anonymous RevenueCat IDs (start with $RCAnonymousID:)
  if (!userId || userId.startsWith('$RCAnonymousID:')) {
    log.debug({ appUserId: userId }, 'Skipping anonymous user event');
    return { success: true, message: 'Anonymous user — skipped' };
  }

  try {
    switch (event.type) {
      // Lifetime purchase (one-time, no expiration)
      case 'NON_RENEWING_PURCHASE':
        if (event.product_id === 'lifetime') {
          await grantAccess(userId, event, Plan.LIFETIME);
        } else {
          await grantAccess(userId, event, Plan.PRO);
        }
        break;

      // Subscription gained access
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'UNCANCELLATION':
      case 'SUBSCRIPTION_EXTENDED':
        await grantAccess(userId, event, Plan.PRO);
        break;

      // User will lose access at end of period (still has access now)
      case 'CANCELLATION':
        log.info({ userId, expirationMs: event.expiration_at_ms }, 'Subscription cancelled — access until expiration');
        // Don't revoke yet — they have access until expiration_at_ms
        break;

      // User lost access
      case 'EXPIRATION':
        await revokeAccess(userId, event);
        break;

      // Payment issue — log but don't revoke (RevenueCat retries)
      case 'BILLING_ISSUE':
        log.warn({ userId, productId: event.product_id }, 'Billing issue — RevenueCat will retry');
        break;

      // Plan change (e.g. monthly → yearly)
      case 'PRODUCT_CHANGE':
        await grantAccess(userId, event, Plan.PRO);
        break;

      // Subscription paused (Google Play only)
      case 'SUBSCRIPTION_PAUSED':
        await revokeAccess(userId, event);
        break;

      default:
        log.debug({ eventType: event.type }, 'Unhandled RevenueCat event type');
    }

    return { success: true, message: `Processed ${event.type}` };
  } catch (error) {
    log.error({ err: error, eventType: event.type, userId }, 'Error processing RevenueCat webhook');
    return { success: false, message: 'Webhook processing failed' };
  }
}

/**
 * Resolve a user from app_user_id or aliases.
 * First tries direct ID lookup, then falls back to searching aliases.
 */
async function resolveUser(appUserId: string, aliases?: string[]) {
  // Try direct lookup by app_user_id (our backend ID)
  const user = await prisma.user.findUnique({ where: { id: appUserId } });
  if (user) return user;

  // Fallback: search aliases (skip anonymous IDs)
  if (aliases?.length) {
    for (const alias of aliases) {
      if (alias.startsWith('$RCAnonymousID:')) continue;
      const found = await prisma.user.findUnique({ where: { id: alias } });
      if (found) return found;
    }
  }

  return null;
}

/**
 * Grant access to a user (PRO or LIFETIME).
 * Never downgrades a LIFETIME user to PRO.
 */
async function grantAccess(userId: string, event: RevenueCatEvent, plan: Plan) {
  const user = await resolveUser(userId, event.aliases);

  if (!user) {
    log.warn({ userId, aliases: event.aliases }, 'User not found for plan grant');
    return;
  }

  // Never downgrade LIFETIME → PRO
  if (user.plan === Plan.LIFETIME && plan === Plan.PRO) {
    log.debug({ userId: user.id }, 'User already LIFETIME — skipping PRO grant');
    return;
  }

  if (user.plan === plan) {
    log.debug({ userId: user.id, plan }, 'User already on target plan');
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { plan, trialEndsAt: null },
  });

  log.info(
    { userId: user.id, plan, productId: event.product_id, eventType: event.type },
    'User plan updated'
  );
}

/**
 * Revoke subscription — downgrade to FREE.
 * Never revokes LIFETIME users (lifetime = permanent access).
 */
async function revokeAccess(userId: string, event: RevenueCatEvent) {
  const user = await resolveUser(userId, event.aliases);

  if (!user) {
    log.warn({ userId, aliases: event.aliases }, 'User not found for revocation');
    return;
  }

  if (user.plan === Plan.LIFETIME) {
    log.debug({ userId: user.id }, 'LIFETIME user — never revoke');
    return;
  }

  if (user.plan === Plan.FREE) {
    log.debug({ userId: user.id }, 'User already FREE — no update needed');
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { plan: Plan.FREE },
  });

  log.info(
    { userId: user.id, productId: event.product_id, eventType: event.type },
    'User downgraded to FREE'
  );
}
