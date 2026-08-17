#!/usr/bin/env node
/**
 * Sync EmailJS (and other) env vars from server/.env to Render gatorvault-api.
 * Requires RENDER_API_KEY in server/.env or environment.
 *
 * Usage:
 *   node scripts/sync-render-env.js
 *   node scripts/sync-render-env.js --deploy
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const API = 'https://api.render.com/v1';
const SERVICE_NAME = 'gatorvault-api';
/** All Render cron jobs that POST to the API with MONITORING/INGEST cron auth. */
const CRON_SERVICES = [
  'gatorvault-api-vault-feed-2028',
  'gatorvault-api-recruiting-light',
  'gatorvault-api-recruiting-ingest',
  'gatorvault-api-beat-ingest',
  'gatorvault-api-hub-refresh',
  'gatorvault-api-hub-warm',
  'gatorvault-api-keepalive',
  'gatorvault-api-platform-ops',
  'gatorvault-api-visit-intel-reconcile',
  'gatorvault-api-visit-intel-recap',
  'gatorvault-api-visit-intel-daily-digest',
  'gatorvault-api-allowlist-on3-rankings',
  'gatorvault-api-on3-rpm-allowlist-sync',
  'gatorvault-api-early-discovery',
  'gatorvault-api-portal-intelligence',
  'gatorvault-api-uf-fit-seed',
  'gatorvault-api-uf-trend-snapshot',
  'gatorvault-api-film-room-youtube-sync',
  'gatorvault-api-community-daily-open',
  'gatorvault-api-gators-score-alerts',
  'gatorvault-api-onboarding-drip',
  'gatorvault-api-fan-digest-weekly',
];

const CRON_SYNC_KEYS = ['MONITORING_CRON_SECRET', 'INGEST_CRON_SECRET', 'NEXT_PUBLIC_API_BASE'];

const SYNC_KEYS = [
  'RESEND_API_KEY',
  'RESEND_FROM',
  'RESEND_REPLY_TO',
  'EMAILJS_USER_ID',
  'EMAILJS_PUBLIC_KEY',
  'EMAILJS_PRIVATE_KEY',
  'EMAILJS_SERVICE_ID',
  'EMAILJS_TEMPLATE_ID',
  'EMAILJS_ONBOARDING_TEMPLATE_ID',
  'EMAILJS_REPLY_TO',
  'EMAIL_PROVIDER',
  'EMAIL_TEST_PIN',
  'RECRUITING_ADMIN_PIN',
  'OPS_ADMIN_PIN',
  'BEEHIIV_API_KEY',
  'BEEHIIV_PUBLICATION_ID',
  'BEEHIIV_AUTOMATION_ID',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'DATABASE_URL',
  'MONITORING_CRON_SECRET',
  'INGEST_CRON_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_WEB_CHECKOUT_ENABLED',
  'STRIPE_PRICE_LOCKER_MONTHLY',
  'STRIPE_PRICE_LOCKER_ANNUAL',
  'STRIPE_PRICE_FILM_MONTHLY',
  'STRIPE_PRICE_FILM_ANNUAL',
  'STRIPE_PRICE_WAR_MONTHLY',
  'STRIPE_PRICE_WAR_ANNUAL',
];

const { PIPELINE_ACTIVATION_ENV } = require('../lib/pipeline-activation-env');

/** Intel schedulers + UF Premium autoposter — enabled on every sync (rewrite stays on). */
const PIPELINE_ENV = {
  ...PIPELINE_ACTIVATION_ENV,
  X_AUTOPOST_PR6_SHADOW: 'true',
  X_AUTOPOST_PR6_ENABLED: 'true',
  X_AUTOPOST_PR7_8_9_SHADOW: 'true',
  X_AUTOPOST_PR7_8_9_ENABLED: 'true',
  X_AUTOPOST_PR789_ANGLE_SHADOW: 'true',
  X_AUTOPOST_PR789_ANGLE_ENABLED: 'false'
};

const key = process.env.RENDER_API_KEY;
if (!key) {
  console.error('Missing RENDER_API_KEY — add to server/.env (Render → Account Settings → API Keys)');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
  Accept: 'application/json'
};

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, { ...opts, headers: { ...headers, ...opts.headers } });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    throw new Error(`${opts.method || 'GET'} ${path} → ${res.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }
  return body;
}

async function findService(name) {
  const rows = await api(`/services?name=${encodeURIComponent(name)}&limit=20`);
  const found = (rows || []).find((row) => (row.service || row).name === name);
  return found ? (found.service || found) : null;
}

async function syncServiceEnv(svc, updates, label) {
  console.log(`\n${label}:`, svc.id, svc.serviceDetails?.url || svc.name);
  for (const u of updates) {
    console.log(`  ${u.key}: ${mask(u.value)}`);
    await api(`/services/${svc.id}/env-vars/${encodeURIComponent(u.key)}`, {
      method: 'PUT',
      body: JSON.stringify({ value: u.value })
    });
  }
}

function mask(val) {
  if (!val) return '(empty)';
  if (val.length <= 8) return '****';
  return `${val.slice(0, 4)}…${val.slice(-4)} (${val.length} chars)`;
}

async function main() {
  const doDeploy = process.argv.includes('--deploy');
  const svc = await findService(SERVICE_NAME);
  if (!svc) throw new Error(`Service ${SERVICE_NAME} not found`);

  const existing = await api(`/services/${svc.id}/env-vars?limit=100`);
  const byKey = {};
  for (const row of existing || []) {
    const ev = row.envVar || row;
    if (ev.key) byKey[ev.key] = ev;
  }

  const updates = [];
  const env = { ...process.env };
  if (!env.EMAILJS_USER_ID && env.EMAILJS_PUBLIC_KEY) {
    env.EMAILJS_USER_ID = env.EMAILJS_PUBLIC_KEY;
  }
  for (const k of SYNC_KEYS) {
    const val = env[k];
    if (val == null || val === '') continue;
    updates.push({ key: k, value: String(val) });
  }
  for (const [k, val] of Object.entries(PIPELINE_ENV)) {
    updates.push({ key: k, value: val });
  }

  if (!updates.length) {
    console.error('No env vars to sync from server/.env');
    process.exit(1);
  }

  console.log('\nSyncing env vars to gatorvault-api:');
  await syncServiceEnv(svc, updates, 'Service');

  const cronSecret = env.MONITORING_CRON_SECRET || env.INGEST_CRON_SECRET;
  if (cronSecret) {
    for (const cronName of CRON_SERVICES) {
      const cronSvc = await findService(cronName);
      if (!cronSvc) {
        console.warn(`Cron service not found (skip): ${cronName}`);
        continue;
      }
      const cronUpdates = CRON_SYNC_KEYS.map((k) => {
        if (k === 'MONITORING_CRON_SECRET' || k === 'INGEST_CRON_SECRET') {
          return { key: k, value: cronSecret };
        }
        const val = env[k] || (k === 'NEXT_PUBLIC_API_BASE' ? 'https://gatorvault-api.onrender.com' : null);
        return val ? { key: k, value: String(val) } : null;
      }).filter(Boolean);
      await syncServiceEnv(cronSvc, cronUpdates, `Cron ${cronName}`);
    }
  }

  console.log('\nEnv sync complete.');

  if (doDeploy) {
    const deploy = await api(`/services/${svc.id}/deploys`, {
      method: 'POST',
      body: JSON.stringify({ clearCache: 'clear' })
    });
    const row = deploy?.deploy || deploy || {};
    console.log('Deploy triggered:', row.id || '(unknown)', row.status || 'started');
    console.log('Monitor: https://dashboard.render.com/web/' + svc.id);
  } else {
    console.log('Note: Render picks up env var changes on next deploy. Re-run with --deploy to redeploy now.');
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
