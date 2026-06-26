#!/usr/bin/env node
/**
 * Render cron — POST portal intelligence (Supabase + JSON store).
 * Skips off-season runs unless PORTAL_INTEL_FORCE_RUN=true.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { shouldRunPortalIntelJob } = require('../lib/recruiting-cycle.ts');

const RECONCILE_URL =
  process.env.PORTAL_INTEL_RUN_URL ||
  'https://gatorvault-api.onrender.com/api/futurecast/portal-intelligence/run';
const CRON_SECRET = process.env.MONITORING_CRON_SECRET || process.env.CRON_SECRET || '';
const LIMIT = Number(process.env.PORTAL_INTEL_LIMIT || 200) || 200;

const RETRY_STATUSES = new Set([502, 503, 504, 429]);
const MAX_ATTEMPTS = 4;
const RETRY_MS = 5000;

async function postReconcile() {
  if (!CRON_SECRET) {
    throw new Error('MONITORING_CRON_SECRET (or CRON_SECRET) is not set');
  }
  const started = Date.now();
  const res = await fetch(RECONCILE_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-monitoring-cron': CRON_SECRET,
      'User-Agent': 'gatorvault-portal-intel-cron/1.0',
    },
    body: JSON.stringify({ limit: LIMIT }),
    signal: AbortSignal.timeout(180000),
  });
  const elapsed = Date.now() - started;
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const err = new Error(`visit intel reconcile HTTP ${res.status} (${elapsed}ms)`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return { status: res.status, elapsed, body };
}

async function postWithRetry() {
  let lastErr;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      return await postReconcile();
    } catch (err) {
      lastErr = err;
      const status = err.status || 0;
      const retryable =
        attempt < MAX_ATTEMPTS - 1 &&
        (RETRY_STATUSES.has(status) ||
          /timeout|ECONNRESET|ECONNREFUSED|fetch failed|network/i.test(String(err.message || '')));
      if (!retryable) break;
      await new Promise((resolve) => setTimeout(resolve, RETRY_MS * (attempt + 1)));
    }
  }
  throw lastErr;
}

if (process.env.PORTAL_INTEL_FORCE_RUN !== 'true' && !shouldRunPortalIntelJob()) {
  console.log(
    '[portal-intel-cron] skipped — portal window closed',
    JSON.stringify({ at: new Date().toISOString() })
  );
  process.exit(0);
}

postWithRetry()
  .then((result) => {
    console.log(
      '[portal-intel-cron] ok',
      JSON.stringify({
        status: result.status,
        elapsedMs: result.elapsed,
        processed: result.body?.result?.playersProcessed ?? null,
        updated: result.body?.result?.playersUpdated ?? null,
        at: new Date().toISOString(),
      })
    );
  })
  .catch((err) => {
    console.error('[portal-intel-cron] failed:', err.message);
    process.exit(1);
  });