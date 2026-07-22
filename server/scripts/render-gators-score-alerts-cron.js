#!/usr/bin/env node
/**
 * Render cron — UF kickoff/final score pushes via the main API.
 *
 * Must run on gatorvault-api (not in this cron process) so APNs device tokens,
 * membership checks, and Postgres-backed push store are available.
 */
try {
  require('./render-cron-env');
} catch {
  /* optional */
}

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.API_BASE ||
  'https://gatorvault-api.onrender.com'
).replace(/\/$/, '');
const CRON_SECRET =
  process.env.MONITORING_CRON_SECRET || process.env.INGEST_CRON_SECRET || process.env.CRON_SECRET || '';
const JOB_TIMEOUT_MS = parseInt(process.env.GATORS_SCORE_ALERTS_TIMEOUT_MS || '90000', 10);

async function runViaApi() {
  if (!CRON_SECRET) {
    throw new Error('MONITORING_CRON_SECRET (or INGEST_CRON_SECRET / CRON_SECRET) is not set');
  }

  const res = await fetch(`${API_BASE}/api/ops/run-job`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-monitoring-cron': CRON_SECRET,
      'X-Ingest-Secret': CRON_SECRET,
      'User-Agent': 'gatorvault-gators-score-alerts-cron/2.0',
    },
    body: JSON.stringify({ jobId: 'gators-score-alerts', options: {} }),
    signal: AbortSignal.timeout(JOB_TIMEOUT_MS),
  });

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const err = new Error(`gators-score-alerts HTTP ${res.status}`);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }

  return payload;
}

async function main() {
  const out = await runViaApi();
  console.log(JSON.stringify({ ok: true, via: 'api', ...out }));
  process.exit(0);
}

main().catch((err) => {
  console.error(
    '[gators-score-alerts-cron]',
    err && err.message ? err.message : err,
    err && err.payload ? JSON.stringify(err.payload) : ''
  );
  // Soft-fail so Render does not page on idle/window skips or brief API blips.
  process.exit(0);
});
