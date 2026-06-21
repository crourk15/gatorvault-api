#!/usr/bin/env node
/**
 * Render cron keep-alive — wakes cold free-tier instances and keeps them warm.
 * Schedule: every 5 minutes (see render.yaml cron service).
 *
 * Cold spin-down returns fast 503 (~50ms). This script retries for up to 3 minutes
 * with long per-request timeouts so the instance actually boots.
 */

const HEALTH_URL =
  process.env.KEEPALIVE_URL ||
  process.env.RENDER_KEEPALIVE_URL ||
  'https://gatorvault-api.onrender.com/health';
const PING_URL =
  process.env.KEEPALIVE_PING_URL || 'https://gatorvault-api.onrender.com/api/ping';
const HUB_URL =
  process.env.KEEPALIVE_HUB_URL ||
  'https://gatorvault-api.onrender.com/api/recruiting/hub/class-overview?year=2027';

const RETRY_STATUSES = new Set([502, 503, 504, 429]);
const WAKE_WINDOW_MS = parseInt(process.env.KEEPALIVE_WAKE_MS || '180000', 10);
const WAKE_INTERVAL_MS = parseInt(process.env.KEEPALIVE_WAKE_INTERVAL_MS || '5000', 10);
const REQUEST_TIMEOUT_MS = parseInt(process.env.KEEPALIVE_TIMEOUT_MS || '90000', 10);

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function pingOnce(url) {
  const started = Date.now();
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json', 'User-Agent': 'gatorvault-keepalive/2.0' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return { ok: res.ok, status: res.status, elapsed: Date.now() - started, res };
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

async function tryPing(url, label) {
  try {
    return await wakeUntilReady(url, label);
  } catch (err) {
    console.warn(`[keepalive] ${label} skipped:`, err.message);
    return null;
  }
}

async function main() {
  const health = await wakeUntilReady(HEALTH_URL, 'health');
  const ping = await tryPing(PING_URL, 'api/ping');
  const hub = await tryPing(HUB_URL, 'hub/class-overview');

  console.log(
    '[keepalive] ok',
    JSON.stringify({
      health,
      ping,
      hub,
      at: new Date().toISOString(),
    })
  );
}

main().catch((err) => {
  console.error('[keepalive] failed:', err.message);
  process.exit(1);
});
