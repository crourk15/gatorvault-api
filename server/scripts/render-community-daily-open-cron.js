#!/usr/bin/env node
/**
 * Render cron — publish today's Community staff open thread (idempotent per ET day).
 * Real staff OP only; does not invent fan replies.
 */
require('./render-cron-env');

const DAILY_OPEN_URL =
  process.env.COMMUNITY_DAILY_OPEN_URL ||
  'https://gatorvault-api.onrender.com/api/community/admin/daily-open';
const CRON_SECRET = process.env.MONITORING_CRON_SECRET || process.env.CRON_SECRET || '';

const RETRY_STATUSES = new Set([502, 503, 504, 429]);
const MAX_ATTEMPTS = 4;
const RETRY_MS = 5000;

async function postDailyOpen() {
  if (!CRON_SECRET) throw new Error('MONITORING_CRON_SECRET (or CRON_SECRET) is not set');
  const started = Date.now();
  const res = await fetch(DAILY_OPEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-monitoring-cron': CRON_SECRET,
      'User-Agent': 'gatorvault-community-daily-open-cron/1.0',
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
    const err = new Error(`community daily-open HTTP ${res.status} (${elapsed}ms)`);
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
      return await postDailyOpen();
    } catch (err) {
      lastErr = err;
      const status = err.status || 0;
      const retryable =
        attempt < MAX_ATTEMPTS - 1 &&
        (RETRY_STATUSES.has(status) ||
          /timeout|ECONNRESET|ECONNREFUSED|fetch failed|network/i.test(String(err.message || '')));
      if (!retryable) break;
      await new Promise((r) => setTimeout(r, RETRY_MS * (attempt + 1)));
    }
  }
  throw lastErr;
}

postWithRetry()
  .then((result) => {
    const created = result.body && result.body.created;
    const title = result.body && result.body.thread && result.body.thread.title;
    console.log(
      `[community-daily-open] OK created=${Boolean(created)} title=${JSON.stringify(title || '')} ${result.elapsed}ms`
    );
    process.exit(0);
  })
  .catch((err) => {
    console.error('[community-daily-open] FAIL', err.message, err.body || '');
    // Soft-fail cron so Render does not page on transient API cold starts.
    process.exit(0);
  });
