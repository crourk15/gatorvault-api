#!/usr/bin/env node
/**
 * Force autoposter pipeline on production — beat ingest, force-post, queue processor.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { primaryAdminPin } = require('../lib/admin-pin');
const { warmApi } = require('../lib/ingest-resilience');

const API = (process.env.QA_API_URL || process.env.API_BASE_URL || 'https://gatorvault-api.onrender.com').replace(
  /\/$/,
  ''
);
const CRON_SECRET = process.env.MONITORING_CRON_SECRET || process.env.INGEST_CRON_SECRET || '';
const PIN =
  process.env.ADMIN_PIN ||
  process.env.OPS_ADMIN_PIN ||
  process.env.RECRUITING_ADMIN_PIN ||
  process.env.EMAIL_TEST_PIN ||
  primaryAdminPin();

function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (CRON_SECRET) {
    headers['x-monitoring-cron'] = CRON_SECRET;
    headers['X-Ingest-Secret'] = CRON_SECRET;
  } else if (PIN) {
    headers['x-ops-pin'] = PIN;
    headers['X-Recruiting-Pin'] = PIN;
    headers['X-Ingest-Secret'] = PIN;
  }
  return headers;
}

async function post(path, body = {}) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(600000)
  });
  const payload = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, payload };
}

async function get(path) {
  const res = await fetch(`${API}${path}`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(120000)
  });
  const payload = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, payload };
}

async function step(label, fn) {
  console.log(`\n[autoposter-force] ${label}…`);
  const out = await fn();
  console.log(JSON.stringify(out.payload, null, 2));
  return out;
}

async function main() {
  if (!CRON_SECRET && !PIN) {
    console.error('Set MONITORING_CRON_SECRET or OPS_ADMIN_PIN in server/.env');
    process.exit(1);
  }

  console.log('[autoposter-force] API:', API);
  const warm = await warmApi(API);
  console.log('[autoposter-force] warm:', warm.ok ? 'ok' : warm.error || 'degraded');

  await step('beat-writer ingest', () => post('/api/recruiting/beat-writer/ingest', { force: true }));
  await step('beat-late ingest', () => post('/api/ops/run-job', { jobId: 'beat-late-ingest' }));
  const forcePost = await step('force-post', () => post('/api/autoposter/force-post', { pin: PIN }));
  const run = await step('x autoposter run', () =>
    post('/api/x/autoposter/run', { force: true, refill: true, limit: 3, pin: PIN })
  );
  const status = await step('autoposter status', () => get('/api/autoposter/status'));
  const ops = await step('ops status (autoposter tile)', () => get('/api/ops/status'));

  const tile = ops.payload?.tiles?.find((t) => /autoposter/i.test(t.id || t.label || ''));
  const posted =
    forcePost.payload?.posted === true ||
    run.payload?.processed > 0 ||
    run.payload?.posted > 0 ||
    status.payload?.lastPostAt;

  console.log('\n[autoposter-force] summary');
  console.log('  force-post:', forcePost.payload?.posted ? 'POSTED' : forcePost.payload?.error || forcePost.status);
  console.log('  queue run processed:', run.payload?.processed ?? run.payload?.reason ?? 'n/a');
  console.log('  lastPostAt:', status.payload?.lastPostAt || status.payload?.lastPostLabel || 'never');
  console.log('  dashboard tile:', tile ? `${tile.status} — ${tile.detail || tile.message || ''}` : 'not found');

  if (!posted && !status.payload?.lastPostAt) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
