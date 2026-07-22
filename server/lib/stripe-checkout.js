/**
 * Web-only Stripe Checkout for membership (browser). Never surface in iOS app.
 *
 * Env:
 *   STRIPE_SECRET_KEY
 *   STRIPE_WEBHOOK_SECRET
 *   STRIPE_PRICE_LOCKER_MONTHLY / STRIPE_PRICE_LOCKER_ANNUAL
 *   STRIPE_PRICE_FILM_MONTHLY / STRIPE_PRICE_FILM_ANNUAL
 *   STRIPE_PRICE_WAR_MONTHLY / STRIPE_PRICE_WAR_ANNUAL
 */
'use strict';

const { normalizeTier } = require('./subscription-config');
const { applySubscription, revokeSubscription } = require('./subscription-service');
const { findUserByEmail, updateUser } = require('./user-store');

function stripeSecret() {
  return String(process.env.STRIPE_SECRET_KEY || '').trim();
}

function stripeWebhookSecret() {
  return String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
}

function isStripeConfigured() {
  return Boolean(stripeSecret());
}

function isWebCheckoutEnabled() {
  if (!isStripeConfigured()) return false;
  const raw = String(process.env.STRIPE_WEB_CHECKOUT_ENABLED || 'true').toLowerCase();
  return !(raw === '0' || raw === 'false' || raw === 'no');
}

function getStripe() {
  const key = stripeSecret();
  if (!key) return null;
  // Lazy require so boot works without the package in environments that never use Stripe.
  // eslint-disable-next-line global-require
  const Stripe = require('stripe');
  return new Stripe(key);
}

function priceEnvMap() {
  return {
    locker: {
      monthly: process.env.STRIPE_PRICE_LOCKER_MONTHLY || '',
      annual: process.env.STRIPE_PRICE_LOCKER_ANNUAL || '',
    },
    film: {
      monthly: process.env.STRIPE_PRICE_FILM_MONTHLY || '',
      annual: process.env.STRIPE_PRICE_FILM_ANNUAL || '',
    },
    war: {
      monthly: process.env.STRIPE_PRICE_WAR_MONTHLY || '',
      annual: process.env.STRIPE_PRICE_WAR_ANNUAL || '',
    },
  };
}

function priceIdFor(tier, interval) {
  const t = normalizeTier(tier);
  const iv = String(interval || 'monthly').toLowerCase() === 'annual' ? 'annual' : 'monthly';
  const id = String(priceEnvMap()[t]?.[iv] || '').trim();
  return id || null;
}

function tierFromPriceId(priceId) {
  const target = String(priceId || '').trim();
  if (!target) return null;
  const map = priceEnvMap();
  for (const [tier, prices] of Object.entries(map)) {
    if (prices.monthly === target || prices.annual === target) return tier;
  }
  return null;
}

function catalogStripeBlock() {
  const map = priceEnvMap();
  const tiers = {};
  for (const [tier, prices] of Object.entries(map)) {
    tiers[tier] = {
      monthlyPriceId: prices.monthly || null,
      annualPriceId: prices.annual || null,
      ready: Boolean(prices.monthly && prices.annual),
    };
  }
  return {
    enabled: isWebCheckoutEnabled(),
    configured: isStripeConfigured(),
    tiers,
  };
}

async function ensureStripeCustomer(stripe, user) {
  const existing = String(user?.subscription?.stripeCustomerId || user?.stripeCustomerId || '').trim();
  if (existing) {
    try {
      const customer = await stripe.customers.retrieve(existing);
      if (customer && !customer.deleted) return customer.id;
    } catch {
      /* create new */
    }
  }
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name || undefined,
    metadata: { gatorvaultEmail: user.email },
  });
  updateUser(user.email, { stripeCustomerId: customer.id });
  return customer.id;
}

async function createCheckoutSession({
  email,
  tier,
  interval = 'monthly',
  successUrl,
  cancelUrl,
} = {}) {
  if (!isWebCheckoutEnabled()) {
    const err = new Error('Web checkout is not enabled.');
    err.status = 503;
    throw err;
  }
  const user = findUserByEmail(email);
  if (!user) {
    const err = new Error('Account not found.');
    err.status = 404;
    throw err;
  }
  const priceId = priceIdFor(tier, interval);
  if (!priceId) {
    const err = new Error('Stripe price is not configured for this plan.');
    err.status = 503;
    err.hint = 'Set STRIPE_PRICE_* env vars for this tier/interval.';
    throw err;
  }
  const stripe = getStripe();
  if (!stripe) {
    const err = new Error('Stripe is not configured.');
    err.status = 503;
    throw err;
  }

  const siteUrl = String(process.env.SITE_URL || 'https://gatorvaultinsider.com').replace(/\/$/, '');
  const customerId = await ensureStripeCustomer(stripe, user);
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: user.email,
    success_url:
      successUrl ||
      `${siteUrl}/vault/membership/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl || `${siteUrl}/vault/membership/?checkout=cancel`,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    metadata: {
      gatorvaultEmail: user.email,
      gatorvaultTier: normalizeTier(tier),
      gatorvaultInterval: String(interval || 'monthly'),
    },
    subscription_data: {
      metadata: {
        gatorvaultEmail: user.email,
        gatorvaultTier: normalizeTier(tier),
      },
    },
  });

  return {
    ok: true,
    url: session.url,
    sessionId: session.id,
  };
}

async function createBillingPortalSession(email, returnUrl) {
  if (!isWebCheckoutEnabled()) {
    const err = new Error('Web checkout is not enabled.');
    err.status = 503;
    throw err;
  }
  const user = findUserByEmail(email);
  if (!user) {
    const err = new Error('Account not found.');
    err.status = 404;
    throw err;
  }
  const stripe = getStripe();
  const customerId = await ensureStripeCustomer(stripe, user);
  const siteUrl = String(process.env.SITE_URL || 'https://gatorvaultinsider.com').replace(/\/$/, '');
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl || `${siteUrl}/vault/membership/`,
  });
  return { ok: true, url: session.url };
}

function expiresAtFromSubscription(subscription) {
  const end = subscription?.current_period_end;
  if (!end) return null;
  return new Date(Number(end) * 1000).toISOString();
}

function mapStripeStatus(stripeStatus, { statusOverride } = {}) {
  if (statusOverride) return statusOverride;
  const s = String(stripeStatus || '').toLowerCase();
  if (s === 'active' || s === 'trialing') return 'active';
  if (s === 'past_due' || s === 'unpaid') return 'grace';
  if (s === 'canceled' || s === 'incomplete_expired') return 'canceled';
  if (s === 'incomplete') return 'grace';
  return 'canceled';
}

function applyStripeSubscription(email, subscription, { statusOverride } = {}) {
  const priceId =
    subscription?.items?.data?.[0]?.price?.id ||
    subscription?.items?.data?.[0]?.plan?.id ||
    null;
  const tier =
    tierFromPriceId(priceId) ||
    normalizeTier(subscription?.metadata?.gatorvaultTier || 'film');
  const stripeStatus = String(subscription?.status || '').toLowerCase();
  const periodEndMs = subscription?.current_period_end
    ? Number(subscription.current_period_end) * 1000
    : null;
  const periodOpen = periodEndMs != null && Number.isFinite(periodEndMs) && periodEndMs > Date.now();
  const customerId =
    typeof subscription?.customer === 'string'
      ? subscription.customer
      : subscription?.customer?.id || null;

  // Fully ended / unpaid with no open period → revoke access.
  if (
    stripeStatus === 'unpaid' ||
    stripeStatus === 'incomplete_expired' ||
    (stripeStatus === 'canceled' && !periodOpen)
  ) {
    return revokeSubscription(email, { status: 'expired', productId: priceId });
  }

  const status = mapStripeStatus(stripeStatus, { statusOverride });
  const keepAccessCanceled = stripeStatus === 'canceled' && periodOpen;
  return applySubscription(email, {
    source: 'stripe',
    status: keepAccessCanceled ? 'canceled' : status,
    productId: priceId || `stripe.${tier}`,
    tier,
    originalTransactionId: String(subscription.id || ''),
    expiresAt: expiresAtFromSubscription(subscription),
    autoRenewEnabled: keepAccessCanceled
      ? false
      : subscription?.cancel_at_period_end === false,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id || null,
  });
}

async function handleStripeWebhookEvent(event) {
  const type = event?.type || '';
  const obj = event?.data?.object || {};

  if (type === 'checkout.session.completed') {
    const email = String(
      obj.client_reference_id || obj.metadata?.gatorvaultEmail || obj.customer_details?.email || ''
    )
      .trim()
      .toLowerCase();
    if (!email || !obj.subscription) {
      return { ok: true, handled: false, reason: 'missing_email_or_subscription', type };
    }
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(String(obj.subscription));
    applyStripeSubscription(email, subscription, { statusOverride: 'active' });
    updateUser(email, {
      stripeCustomerId: typeof obj.customer === 'string' ? obj.customer : null,
    });
    return { ok: true, handled: true, action: 'activated', email, type };
  }

  if (
    type === 'customer.subscription.updated' ||
    type === 'customer.subscription.created' ||
    type === 'customer.subscription.deleted'
  ) {
    const email = String(obj.metadata?.gatorvaultEmail || '').trim().toLowerCase();
    let resolvedEmail = email;
    if (!resolvedEmail && obj.customer) {
      const users = require('./user-store').loadUsers() || [];
      const customerId = String(obj.customer);
      const match = users.find(
        (u) =>
          u.stripeCustomerId === customerId ||
          u.subscription?.stripeCustomerId === customerId ||
          u.subscription?.stripeSubscriptionId === obj.id
      );
      resolvedEmail = match?.email || '';
    }
    if (!resolvedEmail) {
      return { ok: true, handled: false, reason: 'user_not_found', type };
    }
    if (type === 'customer.subscription.deleted') {
      revokeSubscription(resolvedEmail, {
        status: 'expired',
        productId: obj.items?.data?.[0]?.price?.id || null,
      });
      return { ok: true, handled: true, action: 'revoked', email: resolvedEmail, type };
    }
    applyStripeSubscription(resolvedEmail, obj);
    return { ok: true, handled: true, action: 'synced', email: resolvedEmail, type };
  }

  if (type === 'invoice.payment_failed') {
    const subId = obj.subscription;
    const email = String(obj.metadata?.gatorvaultEmail || '').trim().toLowerCase();
    if (subId && email) {
      const user = findUserByEmail(email);
      if (user) {
        applySubscription(email, {
          source: 'stripe',
          status: 'grace',
          productId: user.subscription?.productId || `stripe.${user.tier || 'film'}`,
          tier: user.tier || 'film',
          originalTransactionId: String(subId),
          expiresAt: user.subscription?.expiresAt || null,
          autoRenewEnabled: true,
          stripeCustomerId: user.stripeCustomerId || user.subscription?.stripeCustomerId || null,
          stripeSubscriptionId: String(subId),
        });
        return { ok: true, handled: true, action: 'grace', email, type };
      }
    }
  }

  return { ok: true, handled: false, reason: 'unhandled_type', type };
}

function constructStripeEvent(rawBody, signature) {
  const stripe = getStripe();
  const secret = stripeWebhookSecret();
  if (!stripe || !secret) {
    const err = new Error('Stripe webhook is not configured.');
    err.status = 503;
    throw err;
  }
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

module.exports = {
  isStripeConfigured,
  isWebCheckoutEnabled,
  catalogStripeBlock,
  priceIdFor,
  tierFromPriceId,
  createCheckoutSession,
  createBillingPortalSession,
  handleStripeWebhookEvent,
  constructStripeEvent,
  applyStripeSubscription,
};
