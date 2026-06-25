#!/usr/bin/env node
/**
 * Manual visit intel recap — local or production.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const dryRun = process.argv.includes('--dry-run');
const remote = process.argv.includes('--remote');
const noQueue = process.argv.includes('--no-queue');

async function runLocal() {
  const { runVisitIntelRecap } = require('../lib/visit-intel-recap');
  return runVisitIntelRecap({ dryRun, queueX: !noQueue });
}

async function runRemote() {
  const base = (process.env.NEXT_PUBLIC_API_BASE || process.env.API_BASE || 'https://gatorvault-api.onrender.com').replace(/\/$/, '');
  const secret = process.env.MONITORING_CRON_SECRET || process.env.CRON_SECRET || '';
  if (!secret) throw new Error('MONITORING_CRON_SECRET is not set');
  const params = new URLSearchParams();
  if (dryRun) params.set('dryRun', 'true');
  if (noQueue) params.set('queueX', 'false');
  const qs = params.toString() ? `?${params}` : '';
  const res = await fetch(`${base}/api/futurecast/visit-intel/recap${qs}`, {
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
  console.error('[run-visit-intel-recap]', err.message);
  process.exit(1);
});