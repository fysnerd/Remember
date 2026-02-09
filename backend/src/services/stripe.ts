// Stripe Subscription Service (S019)
import Stripe from 'stripe';
import { config } from '../config/env.js';
import { prisma } from '../config/database.js';
import { Plan } from '@prisma/client';
import { logger } from '../config/logger.js';

const log = logger.child({ service: 'stripe' });

// Initialize Stripe (only if API key is configured)
const stripe = config.stripe.secretKey
  ? new Stripe(config.stripe.secretKey, { apiVersion: '2025-02-24.acacia' })
  : null;

/**
 * Create a Stripe Checkout session for subscription
 */
export async function createCheckoutSession(
  userId: string,
  priceType: 'monthly' | 'yearly'
): Promise<{ url: string } | { error: string }> {
  if (!stripe) {
    return { error: 'Stripe not configured' };
  }

  const priceId = priceType === 'monthly'
    ? config.stripe.priceMonthly
    : config.stripe.priceYearly;

  if (!priceId) {
    return { error: `Stripe ${priceType} price not configured` };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return { error: 'User not found' };
  }

  try {
    // Check if user already has a Stripe customer ID
    let customerId: string | undefined;

    // Look for existing customer by email
    const existingCustomers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id;
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${config.frontendUrl}/settings?subscription=success`,
      cancel_url: `${config.frontendUrl}/settings?subscription=cancelled`,
      metadata: {
        userId,
      },
      subscription_data: {
        metadata: {
          userId,
        },
      },
    });

    if (!session.url) {
      return { error: 'Failed to create checkout session' };
    }

    return { url: session.url };
  } catch (error) {
    log.error({ err: error, userId }, 'Error creating checkout session');
    return { error: 'Failed to create checkout session' };
  }
}

/**
 * Create a Stripe Customer Portal session for subscription management
 */
export async function createPortalSession(
  userId: string
): Promise<{ url: string } | { error: string }> {
  if (!stripe) {
    return { error: 'Stripe not configured' };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return { error: 'User not found' };
  }

  try {
    // Find Stripe customer by email
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });

    if (customers.data.length === 0) {
      return { error: 'No subscription found' };
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customers.data[0].id,
      return_url: `${config.frontendUrl}/settings`,
    });

    return { url: session.url };
  } catch (error) {
    log.error({ err: error, userId }, 'Error creating portal session');
    return { error: 'Failed to create portal session' };
  }
}

/**
 * Handle Stripe webhook events
 */
export async function handleStripeWebhook(
  payload: string | Buffer,
  signature: string
): Promise<{ success: boolean; message: string }> {
  if (!stripe || !config.stripe.webhookSecret) {
    return { success: false, message: 'Stripe not configured' };
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      config.stripe.webhookSecret
    );
  } catch (error) {
    log.error({ err: error }, 'Webhook signature verification failed');
    return { success: false, message: 'Invalid signature' };
  }

  log.info({ eventType: event.type }, 'Received webhook event');

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        log.debug({ eventType: event.type }, 'Unhandled event type');
    }

    return { success: true, message: 'Webhook processed' };
  } catch (error) {
    log.error({ err: error, eventType: event.type }, 'Error processing webhook');
    return { success: false, message: 'Webhook processing failed' };
  }
}

/**
 * Handle successful checkout completion
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  if (!userId) {
    log.error({ sessionId: session.id }, 'No userId in checkout session metadata');
    return;
  }

  log.info({ userId, sessionId: session.id }, 'Checkout completed');

  // Update user plan to PRO
  await prisma.user.update({
    where: { id: userId },
    data: {
      plan: Plan.PRO,
      trialEndsAt: null, // Clear trial
    },
  });

  log.info({ userId }, 'User plan updated to PRO');
}

/**
 * Handle subscription updates (created, updated)
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    // Try to find user by customer email
    if (!stripe) return;

    const customer = await stripe.customers.retrieve(subscription.customer as string);
    if (customer.deleted) return;

    const user = await prisma.user.findUnique({
      where: { email: customer.email || '' },
    });

    if (!user) {
      log.error({ subscriptionId: subscription.id }, 'Could not find user for subscription');
      return;
    }

    const plan = subscription.status === 'active' ? Plan.PRO : Plan.FREE;
    await prisma.user.update({
      where: { id: user.id },
      data: { plan },
    });

    log.info({ userId: user.id, plan, subscriptionStatus: subscription.status }, 'User plan updated');
    return;
  }

  const plan = subscription.status === 'active' ? Plan.PRO : Plan.FREE;
  await prisma.user.update({
    where: { id: userId },
    data: { plan },
  });

  log.info({ userId, plan, subscriptionStatus: subscription.status }, 'User plan updated');
}

/**
 * Handle subscription deletion (cancelled)
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    // Try to find user by customer email
    if (!stripe) return;

    const customer = await stripe.customers.retrieve(subscription.customer as string);
    if (customer.deleted) return;

    const user = await prisma.user.findUnique({
      where: { email: customer.email || '' },
    });

    if (!user) {
      log.error({ subscriptionId: subscription.id }, 'Could not find user for cancelled subscription');
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { plan: Plan.FREE },
    });

    log.info({ userId: user.id }, 'User plan downgraded to FREE');
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { plan: Plan.FREE },
  });

  log.info({ userId }, 'User plan downgraded to FREE');
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  if (!stripe) return;

  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return;

  log.warn({ customerEmail: customer.email }, 'Payment failed for customer');

  // Note: We don't immediately downgrade - Stripe will retry
  // After all retries fail, subscription.deleted event will fire
}

/**
 * Get user's subscription status
 */
export async function getSubscriptionStatus(userId: string): Promise<{
  plan: Plan;
  isTrialing: boolean;
  trialEndsAt: Date | null;
  hasActiveSubscription: boolean;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return {
      plan: Plan.FREE,
      isTrialing: false,
      trialEndsAt: null,
      hasActiveSubscription: false,
    };
  }

  const isTrialing = user.trialEndsAt ? user.trialEndsAt > new Date() : false;

  return {
    plan: user.plan,
    isTrialing,
    trialEndsAt: user.trialEndsAt,
    hasActiveSubscription: user.plan === Plan.PRO,
  };
}
