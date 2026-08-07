#!/usr/bin/env node
/**
 * Render cron — refill hub + FutureCast Lab in-process memory (Tier B).
 * Member GETs serve disk/SWR only; this cron owns the rebuild.
 */
require('./render-cron-env');

const API_ORIGIN = process.env.HUB_WARM_API_ORIGIN || 'https://gatorvault-api.onrender.com';
const CRON_SECRET = process.env.MONITORING_CRON_SECRET || process.env.CRON_SECRET || '';

const HUB_WARM_URL =
  process.env.HUB_WARM_URL ||
  `${API_ORIGIN}/api/recruiting/hub/warm-memory?mode=priority`;
const LAB_WARM_URL =
  process.env.LAB_WARM_URL || `${API_ORIGIN}/api/futurecast/lab-warm?years=2027,2028`;

const RETRY_STATUSES = new Set([502, 503, 504, 429]);
const MAX_ATTEMPTS = 3;
const RETRY_MS = 4000;

async function postWarm(url, label) {
  if (!CRON_SECRET) {
    throw new Error('MONITORING_CRON_SECRET (or CRON_SECRET) is not set');
  }
  const started = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-monitoring-cron': CRON_SECRET,
      'User-Agent': 'gatorvault-hub-warm-cron/1.0',
    },
    body: '{}',
    signal: AbortSignal.timeout(60000),
  });
  const elapsed = Date.now() - started;
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const err = new Error(`${label} HTTP ${res.status} (${elapsed}ms)`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return { label, status: res.status, elapsed, body };
}

async function postWithRetry(url, label) {
  let lastErr;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      return await postWarm(url, label);
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
  const results = [];
  try {
    results.push(await postWithRetry(HUB_WARM_URL, 'hub-warm'));
  } catch (err) {
    console.error('[hub-warm-cron] hub-warm failed:', err.message);
  }
  try {
    results.push(await postWithRetry(LAB_WARM_URL, 'lab-warm'));
  } catch (err) {
    console.error('[hub-warm-cron] lab-warm failed:', err.message);
  }
  console.log(
    '[hub-warm-cron] done',
    JSON.stringify({
      ok: results.length > 0,
      results: results.map((r) => ({
        label: r.label,
        status: r.status,
        elapsedMs: r.elapsed,
        accepted: r.body?.accepted ?? null,
      })),
      at: new Date().toISOString(),
    })
  );
  process.exit(0);
})();
