#!/usr/bin/env node
/**
 * Render cron keep-alive — pings the API so the free-tier web service stays warm.
 * Schedule: every 5 minutes (see render.yaml cron service).
 */
const fetch = require('node-fetch');

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
const MAX_ATTEMPTS = 4;
const RETRY_MS = 3000;

async function pingOnce(url, label) {
  const started = Date.now();
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json', 'User-Agent': 'gatorvault-keepalive/1.0' },
    timeout: 25000,
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
  return { ok: true, status: res.status, elapsed, body };
}

async function pingWithRetry(url, label) {
  let lastErr;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      return await pingOnce(url, label);
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

async function main() {
  const health = await pingWithRetry(HEALTH_URL, 'health');
  let ping = null;
  let hub = null;
  try {
    ping = await pingWithRetry(PING_URL, 'api/ping');
  } catch (err) {
    console.warn('[keepalive] api/ping failed after health ok:', err.message);
  }
  try {
    hub = await pingWithRetry(HUB_URL, 'hub/class-overview');
  } catch (err) {
    console.warn('[keepalive] hub warm ping failed:', err.message);
  }
  console.log(
    '[keepalive] ok',
    JSON.stringify({
      health: { status: health.status, elapsedMs: health.elapsed },
      ping: ping ? { status: ping.status, elapsedMs: ping.elapsed } : null,
      hub: hub ? { status: hub.status, elapsedMs: hub.elapsed, hubStatus: hub.body?.status ?? null } : null,
      at: new Date().toISOString(),
    })
  );
}

main().catch((err) => {
  console.error('[keepalive] failed:', err.message);
  process.exit(1);
});
