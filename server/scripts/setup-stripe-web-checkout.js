#!/usr/bin/env node
/**
 * One-shot Stripe web checkout setup for GatorVault.
 *
 * Creates Products + 6 recurring Prices, registers the webhook, optionally
 * pushes env vars to Render and redeploys.
 *
 * Usage (from server/):
 *   STRIPE_SECRET_KEY=sk_live_... node scripts/setup-stripe-web-checkout.js
 *   STRIPE_SECRET_KEY=sk_live_... RENDER_API_KEY=rnd_... node scripts/setup-stripe-web-checkout.js --deploy
 *
 * Safe to re-run: reuses existing products/prices matched by metadata lookup_key.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const Stripe = require('stripe');

const WEBHOOK_URL =
  process.env.STRIPE_WEBHOOK_URL ||
  'https://gatorvault-api.onrender.com/api/subscription/stripe/webhook';
const WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_failed',
];
const RENDER_API = 'https://api.render.com/v1';
const SERVICE_NAME = 'gatorvault-api';

const PLANS = [
  { tier: 'locker', name: 'Locker Room', monthly: 499, annual: 4788 },
  { tier: 'film', name: 'Film Room', monthly: 999, annual: 9588 },
  { tier: 'war', name: 'War Room', monthly: 1999, annual: 19188 },
];

function clean(v) {
  return String(v || '').trim();
}

function mask(val) {
  if (!val) return '(empty)';
  if (val.length <= 8) return '****';
  return `${val.slice(0, 6)}…${val.slice(-4)} (${val.length} chars)`;
}

async function findOrCreateProduct(stripe, plan) {
  const lookup = `gatorvault_${plan.tier}`;
  const existing = await stripe.products.search({
    query: `metadata['gatorvaultTier']:'${plan.tier}' AND active:'true'`,
    limit: 1,
  }).catch(() => null);
  if (existing?.data?.[0]) return existing.data[0];

  // Fallback list scan (search may be unavailable on some accounts).
  const listed = await stripe.products.list({ limit: 100, active: true });
  const hit = (listed.data || []).find(
    (p) => p.metadata?.gatorvaultTier === plan.tier || p.metadata?.lookup_key === lookup
  );
  if (hit) return hit;

  return stripe.products.create({
    name: `GatorVault ${plan.name}`,
    description: `GatorVault Insider — ${plan.name} membership`,
    metadata: {
      gatorvaultTier: plan.tier,
      lookup_key: lookup,
      brand: 'GatorVault Media, LLC',
    },
  });
}

async function findOrCreatePrice(stripe, productId, plan, interval) {
  const lookupKey = `gatorvault_${plan.tier}_${interval}`;
  const unitAmount = interval === 'year' ? plan.annual : plan.monthly;

  try {
    const byLookup = await stripe.prices.list({
      lookup_keys: [lookupKey],
      limit: 1,
      active: true,
    });
    if (byLookup.data?.[0]) return byLookup.data[0];
  } catch {
    /* continue */
  }

  const listed = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  const hit = (listed.data || []).find(
    (p) =>
      p.recurring?.interval === interval &&
      p.unit_amount === unitAmount &&
      p.currency === 'usd'
  );
  if (hit) return hit;

  return stripe.prices.create({
    product: productId,
    currency: 'usd',
    unit_amount: unitAmount,
    recurring: { interval },
    lookup_key: lookupKey,
    metadata: {
      gatorvaultTier: plan.tier,
      gatorvaultInterval: interval === 'year' ? 'annual' : 'monthly',
    },
  });
}

async function ensureWebhook(stripe) {
  const existing = await stripe.webhookEndpoints.list({ limit: 100 });
  const hit = (existing.data || []).find((w) => w.url === WEBHOOK_URL);
  if (hit) {
    // Stripe does not return the secret again — keep existing env unless --rotate-webhook.
    const rotate = process.argv.includes('--rotate-webhook');
    if (!rotate) {
      return { id: hit.id, secret: null, reused: true };
    }
    await stripe.webhookEndpoints.del(hit.id);
  }
  const created = await stripe.webhookEndpoints.create({
    url: WEBHOOK_URL,
    enabled_events: WEBHOOK_EVENTS,
    description: 'GatorVault membership entitlements',
    metadata: { app: 'gatorvault-api' },
  });
  return { id: created.id, secret: created.secret, reused: false };
}

async function ensureCustomerPortal(stripe) {
  try {
    await stripe.billingPortal.configurations.create({
      business_profile: {
        headline: 'GatorVault membership',
        privacy_policy_url: 'https://gatorvaultinsider.com/privacy/',
        terms_of_service_url: 'https://gatorvaultinsider.com/terms/',
      },
      features: {
        customer_update: {
          enabled: true,
          allowed_updates: ['email', 'address'],
        },
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        subscription_cancel: { enabled: true, mode: 'at_period_end' },
        subscription_update: {
          enabled: true,
          default_allowed_updates: ['price'],
          proration_behavior: 'create_prorations',
        },
      },
    });
    return { ok: true, created: true };
  } catch (err) {
    // Already configured / restricted — portal may already exist in Dashboard.
    return { ok: true, created: false, note: err.message };
  }
}

async function pushToRender(envMap, { deploy }) {
  const renderKey = clean(process.env.RENDER_API_KEY);
  if (!renderKey) {
    console.log('\nRENDER_API_KEY not set — skipping Render env sync.');
    console.log('Paste these into Render → gatorvault-api → Environment:\n');
    for (const [k, v] of Object.entries(envMap)) {
      console.log(`${k}=${v}`);
    }
    return { synced: false };
  }

  const headers = {
    Authorization: `Bearer ${renderKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  async function api(path, opts = {}) {
    const res = await fetch(`${RENDER_API}${path}`, {
      ...opts,
      headers: { ...headers, ...opts.headers },
    });
    const text = await res.text();
    let body;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (!res.ok) {
      throw new Error(
        `${opts.method || 'GET'} ${path} → ${res.status}: ${
          typeof body === 'string' ? body : JSON.stringify(body)
        }`
      );
    }
    return body;
  }

  const rows = await api(`/services?name=${encodeURIComponent(SERVICE_NAME)}&limit=20`);
  const svc = (rows || []).find((row) => (row.service || row).name === SERVICE_NAME);
  if (!svc) throw new Error(`Render service ${SERVICE_NAME} not found`);
  const service = svc.service || svc;
  console.log('\nRender service:', service.id);

  for (const [k, value] of Object.entries(envMap)) {
    console.log(`  set ${k}: ${mask(value)}`);
    await api(`/services/${service.id}/env-vars/${encodeURIComponent(k)}`, {
      method: 'PUT',
      body: JSON.stringify({ value: String(value) }),
    });
  }

  if (deploy || process.argv.includes('--deploy')) {
    const deployRes = await api(`/services/${service.id}/deploys`, {
      method: 'POST',
      body: JSON.stringify({ clearCache: 'clear' }),
    });
    const row = deployRes.deploy || deployRes;
    console.log('Deploy triggered:', row.id, row.status || 'started');
  } else {
    console.log('Re-run with --deploy to redeploy now.');
  }
  return { synced: true, serviceId: service.id };
}

async function main() {
  const secret = clean(process.env.STRIPE_SECRET_KEY);
  if (!secret) {
    console.error('Missing STRIPE_SECRET_KEY');
    console.error('Usage: STRIPE_SECRET_KEY=sk_live_... node scripts/setup-stripe-web-checkout.js --deploy');
    process.exit(1);
  }
  if (!secret.startsWith('sk_')) {
    console.error('STRIPE_SECRET_KEY should start with sk_test_ or sk_live_');
    process.exit(1);
  }

  const stripe = new Stripe(secret);
  const mode = secret.startsWith('sk_live_') ? 'live' : 'test';
  console.log(`Stripe mode: ${mode}`);

  const priceIds = {};
  for (const plan of PLANS) {
    const product = await findOrCreateProduct(stripe, plan);
    console.log(`Product ${plan.tier}: ${product.id} (${product.name})`);
    const monthly = await findOrCreatePrice(stripe, product.id, plan, 'month');
    const annual = await findOrCreatePrice(stripe, product.id, plan, 'year');
    priceIds[`STRIPE_PRICE_${plan.tier.toUpperCase()}_MONTHLY`] = monthly.id;
    priceIds[`STRIPE_PRICE_${plan.tier.toUpperCase()}_ANNUAL`] = annual.id;
    console.log(`  monthly ${monthly.id} ($${(plan.monthly / 100).toFixed(2)})`);
    console.log(`  annual  ${annual.id} ($${(plan.annual / 100).toFixed(2)})`);
  }

  const webhook = await ensureWebhook(stripe);
  console.log(
    webhook.reused
      ? `\nWebhook reused: ${webhook.id} (secret unchanged — use existing STRIPE_WEBHOOK_SECRET or pass --rotate-webhook)`
      : `\nWebhook created: ${webhook.id}`
  );

  const portal = await ensureCustomerPortal(stripe);
  console.log(
    portal.created
      ? 'Customer portal configuration created.'
      : `Customer portal: ${portal.note || 'already configured / skipped'}`
  );

  const envMap = {
    STRIPE_SECRET_KEY: secret,
    STRIPE_WEB_CHECKOUT_ENABLED: 'true',
    ...priceIds,
  };
  if (webhook.secret) {
    envMap.STRIPE_WEBHOOK_SECRET = webhook.secret;
  } else if (clean(process.env.STRIPE_WEBHOOK_SECRET)) {
    envMap.STRIPE_WEBHOOK_SECRET = clean(process.env.STRIPE_WEBHOOK_SECRET);
  }

  console.log('\n=== Env ready ===');
  for (const [k, v] of Object.entries(envMap)) {
    console.log(`${k}=${v}`);
  }
  if (!envMap.STRIPE_WEBHOOK_SECRET) {
    console.log(
      '\nNOTE: Webhook already existed so Stripe did not return a new secret.\n' +
        'If Render does not already have STRIPE_WEBHOOK_SECRET, re-run with --rotate-webhook\n' +
        'or copy the signing secret from Stripe Dashboard → Developers → Webhooks.'
    );
  }

  await pushToRender(envMap, { deploy: process.argv.includes('--deploy') });

  // Write local .env.stripe.out (gitignored pattern) for operator copy/paste.
  const outPath = require('path').join(__dirname, '..', '.env.stripe.out');
  require('fs').writeFileSync(
    outPath,
    Object.entries(envMap)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n') + '\n'
  );
  console.log(`\nWrote ${outPath}`);
  console.log('Done.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
