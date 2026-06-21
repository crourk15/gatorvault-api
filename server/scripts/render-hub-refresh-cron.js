#!/usr/bin/env node
/**
 * Render cron — POST hub refresh so elite caches rebuild on a schedule.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const REFRESH_URL =
  process.env.HUB_REFRESH_URL ||
  'https://gatorvault-api.onrender.com/api/recruiting/hub/refresh?geoBackfill=true';
const CRON_SECRET = process.env.MONITORING_CRON_SECRET || process.env.CRON_SECRET || '';

const RETRY_STATUSES = new Set([502, 503, 504, 429]);
const MAX_ATTEMPTS = 4;
const RETRY_MS = 5000;

async function postRefresh() {
  if (!CRON_SECRET) {
    throw new Error('MONITORING_CRON_SECRET (or CRON_SECRET) is not set');
  }
  const started = Date.now();
  const res = await fetch(REFRESH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-monitoring-cron': CRON_SECRET,
      'User-Agent': 'gatorvault-hub-refresh-cron/1.0',
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
    const err = new Error(`hub refresh HTTP ${res.status} (${elapsed}ms)`);
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
      return await postRefresh();
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

postWithRetry()
  .then((result) => {
    console.log(
      '[hub-refresh-cron] ok',
      JSON.stringify({
        status: result.status,
        elapsedMs: result.elapsed,
        enriched: result.body?.enrichedPlayerCount ?? null,
        at: new Date().toISOString(),
      })
    );
  })
  .catch((err) => {
    console.error('[hub-refresh-cron] failed:', err.message);
    process.exit(1);
  });
