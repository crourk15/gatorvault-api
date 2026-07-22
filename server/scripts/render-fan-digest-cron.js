#!/usr/bin/env node
/**
 * Render cron — send weekly fan digest (beat + recruiting + visits).
 */
require('./render-cron-env');

const PROCESS_URL =
  process.env.FAN_DIGEST_WEEKLY_URL ||
  'https://gatorvault-api.onrender.com/api/fan-digest/weekly';
const CRON_SECRET = process.env.MONITORING_CRON_SECRET || process.env.CRON_SECRET || '';

const RETRY_STATUSES = new Set([502, 503, 504, 429]);
const MAX_ATTEMPTS = 4;
const RETRY_MS = 5000;

async function postProcess() {
  if (!CRON_SECRET) throw new Error('MONITORING_CRON_SECRET (or CRON_SECRET) is not set');
  const started = Date.now();
  const res = await fetch(PROCESS_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-monitoring-cron': CRON_SECRET,
      'User-Agent': 'gatorvault-fan-digest-cron/1.0',
    },
    body: '{}',
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
    const err = new Error(`fan digest HTTP ${res.status} (${elapsed}ms)`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  console.log('[fan-digest-cron] OK', {
    elapsed,
    sent: body?.sent,
    weekKey: body?.weekKey,
    recipients: body?.recipients,
  });
  return body;
}

async function main() {
  let lastErr = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await postProcess();
      process.exit(0);
    } catch (err) {
      lastErr = err;
      const retryable = RETRY_STATUSES.has(err.status);
      console.warn(`[fan-digest-cron] attempt ${attempt} failed:`, err.message);
      if (!retryable || attempt === MAX_ATTEMPTS) break;
      await new Promise((r) => setTimeout(r, RETRY_MS * attempt));
    }
  }
  console.error('[fan-digest-cron] giving up', lastErr?.message || lastErr);
  process.exit(0); // soft-fail cron
}

main();
