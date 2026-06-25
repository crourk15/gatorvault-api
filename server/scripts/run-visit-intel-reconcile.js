#!/usr/bin/env node
/**
 * Manual visit intel reconcile — local or production.
 * Usage:
 *   node scripts/run-visit-intel-reconcile.js
 *   node scripts/run-visit-intel-reconcile.js --dry-run
 *   node scripts/run-visit-intel-reconcile.js --remote
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const dryRun = process.argv.includes('--dry-run');
const remote = process.argv.includes('--remote');

async function runLocal() {
  const { reconcileVisitIntelInStore } = require('../lib/expire-stale-visit-intel');
  return reconcileVisitIntelInStore({ dryRun });
}

async function runRemote() {
  const base = (process.env.NEXT_PUBLIC_API_BASE || process.env.API_BASE || 'https://gatorvault-api.onrender.com').replace(/\/$/, '');
  const secret = process.env.MONITORING_CRON_SECRET || process.env.CRON_SECRET || '';
  if (!secret) throw new Error('MONITORING_CRON_SECRET is not set');
  const qs = dryRun ? '?dryRun=true' : '';
  const res = await fetch(`${base}/api/futurecast/visit-intel/reconcile${qs}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-monitoring-cron': secret,
    },
    body: '{}',
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
  return body;
}

(async () => {
  const result = remote ? await runRemote() : await runLocal();
  console.log(JSON.stringify(result, null, 2));
})().catch((err) => {
  console.error('[run-visit-intel-reconcile]', err.message);
  process.exit(1);
});