#!/usr/bin/env node
/**
 * Render cron keep-alive — lightweight wake + soft hub touch.
 * Schedule: every 2 minutes (see render.yaml cron service).
 *
 * Hits api/ping first, then optional class-overview so Starter keeps
 * recruiting hub cache warm for fans (not just process alive).
 */
const PING_URL =
  process.env.KEEPALIVE_PING_URL ||
  process.env.KEEPALIVE_URL ||
  process.env.RENDER_KEEPALIVE_URL ||
  'https://gatorvault-api.onrender.com/api/ping';

const HUB_URL =
  process.env.KEEPALIVE_HUB_URL ||
  'https://gatorvault-api.onrender.com/api/recruiting/hub/bundle?year=2027';

const RETRY_STATUSES = new Set([502, 503, 504, 429]);
const WAKE_WINDOW_MS = parseInt(process.env.KEEPALIVE_WAKE_MS || '180000', 10);
const WAKE_INTERVAL_MS = parseInt(process.env.KEEPALIVE_WAKE_INTERVAL_MS || '5000', 10);
const REQUEST_TIMEOUT_MS = parseInt(process.env.KEEPALIVE_TIMEOUT_MS || '90000', 10);
const HUB_TIMEOUT_MS = parseInt(process.env.KEEPALIVE_HUB_TIMEOUT_MS || '45000', 10);

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function pingOnce(url, timeoutMs = REQUEST_TIMEOUT_MS) {
  const started = Date.now();
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json', 'User-Agent': 'gatorvault-keepalive/3.1' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  return { ok: res.ok, status: res.status, elapsed: Date.now() - started };
}

async function wakeUntilReady(url, label) {
  const deadline = Date.now() + WAKE_WINDOW_MS;
  let lastStatus = 0;
  let attempts = 0;

  while (Date.now() < deadline) {
    attempts += 1;
    try {
      const result = await pingOnce(url);
      lastStatus = result.status;
      if (result.ok) {
        return { status: result.status, elapsedMs: result.elapsed, attempts };
      }
      if (!RETRY_STATUSES.has(result.status)) {
        throw new Error(`${label} HTTP ${result.status} (${result.elapsed}ms)`);
      }
    } catch (err) {
      const status = err.status || 0;
      if (status && !RETRY_STATUSES.has(status)) {
        throw err;
      }
    }
    await sleep(WAKE_INTERVAL_MS);
  }

  throw new Error(`${label} wake failed after ${attempts} attempts (last HTTP ${lastStatus})`);
}

async function softHubTouch(url) {
  if (!url || process.env.KEEPALIVE_HUB_TOUCH === 'false') {
    return { skipped: true };
  }
  try {
    const result = await pingOnce(url, HUB_TIMEOUT_MS);
    return { ok: result.ok, status: result.status, elapsedMs: result.elapsed };
  } catch (err) {
    return { ok: false, error: String(err.message || err).slice(0, 120) };
  }
}

async function main() {
  const ping = await wakeUntilReady(PING_URL, 'api/ping');
  const hub = await softHubTouch(HUB_URL);
  console.log('[keepalive] ok', JSON.stringify({ ping, hub, at: new Date().toISOString() }));
}

(async () => {
  try {
    await main();
  } catch (err) {
    console.error('[keepalive] failed:', err.message);
  }
  process.exit(0);
})();
