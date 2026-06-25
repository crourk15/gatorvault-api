#!/usr/bin/env node
/**
 * Trigger ops jobs on production Render via ops API.
 * Usage:
 *   node scripts/run-production-cleanup.js [jobId]
 *   node scripts/run-production-cleanup.js --recover
 * Requires RECRUITING_ADMIN_PIN, OPS_ADMIN_PIN, or MONITORING_CRON_SECRET in server/.env
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

const RECOVERY_JOBS = [
  'recruiting-ingest',
  'portal-ingest',
  'beat-writer-ingest',
  'beat-late-ingest',
  'x-autoposter-run',
  'nil-refresh',
  'depth-chart-refresh',
  'game-zone-refresh',
  'qa-crawler',
  'self-runner-scan',
  'ops-healthcheck'
];

const INGEST_STEPS = [
  { name: 'on3', path: '/api/recruiting/ingest' },
  { name: 'portal', path: '/api/recruiting/portal/sync' },
  { name: 'beat-writer', path: '/api/recruiting/beat-writer/ingest' },
  { name: 'beat-visit', path: '/api/recruiting/beat-visit/ingest' },
  { name: 'live-refresh', path: '/api/live/refresh' },
  { name: 'hub-refresh', path: '/api/recruiting/hub/refresh?geoBackfill=true' }
];

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

async function runJob(jobId) {
  console.log(`POST ${API}/api/ops/run-job jobId=${jobId}`);
  const out = await post('/api/ops/run-job', { jobId, options: {} });
  console.log(JSON.stringify(out.payload, null, 2));
  return out.ok && out.payload?.ok !== false;
}

async function recoverAll() {
  if (!CRON_SECRET && !PIN) {
    console.error('Set MONITORING_CRON_SECRET or OPS_ADMIN_PIN in server/.env');
    process.exit(1);
  }
  console.log('[ops-recovery] warming API…');
  const warm = await warmApi(API);
  console.log('[ops-recovery] warm:', warm.ok ? 'ok' : warm.error || 'degraded');

  let failures = 0;
  for (const step of INGEST_STEPS) {
    console.log(`POST ${API}${step.path} (${step.name})`);
    const out = await post(step.path);
    const ok = out.ok && out.payload?.ok !== false;
    if (!ok) failures += 1;
    console.log(`[ops-recovery] ${step.name}:`, ok ? 'ok' : out.payload?.error || out.status);
  }
  for (const jobId of RECOVERY_JOBS) {
    const ok = await runJob(jobId);
    if (!ok) failures += 1;
  }
  console.log('[ops-recovery] complete failures=', failures);
  if (failures) process.exit(1);
}

async function main() {
  if (process.argv.includes('--recover')) {
    return recoverAll();
  }
  if (!PIN && !CRON_SECRET) {
    console.error('Set OPS_ADMIN_PIN or MONITORING_CRON_SECRET in server/.env');
    process.exit(1);
  }

  const jobId = process.argv[2] || 'post-deploy-feed-cleanup';
  const ok = await runJob(jobId);
  if (!ok) process.exit(1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
