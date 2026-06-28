#!/usr/bin/env node
/**
 * Render cron — POST visit intel reconcile (Supabase + JSON store).
 */
require('./render-cron-env');

const RECONCILE_URL =
  process.env.VISIT_INTEL_RECONCILE_URL ||
  'https://gatorvault-api.onrender.com/api/futurecast/visit-intel/reconcile';
const CRON_SECRET = process.env.MONITORING_CRON_SECRET || process.env.CRON_SECRET || '';

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
      'User-Agent': 'gatorvault-visit-intel-reconcile-cron/1.0',
    },
    body: '{}',
    signal: AbortSignal.timeout(120000),
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

(async () => {
  try {
    const result = await postWithRetry();
    console.log(
      '[visit-intel-reconcile-cron] ok',
      JSON.stringify({
        status: result.status,
        elapsedMs: result.elapsed,
        expired: result.body?.expired ?? null,
        storageMode: result.body?.storageMode ?? null,
        at: new Date().toISOString(),
      })
    );
  } catch (err) {
    console.error('[visit-intel-reconcile-cron] failed:', err.message);
  }
  process.exit(0);
})();