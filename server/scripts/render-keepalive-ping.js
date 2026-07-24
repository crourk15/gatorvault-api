#!/usr/bin/env node
/**
 * Render cron keep-alive — lightweight wake + soft hub touch bundle.
 * Schedule: every 2 minutes (see render.yaml cron service).
 *
 * Hits api/ping first, then pillar endpoints in a small concurrent pool
 * so fan caches stay warm (not just process alive).
 */
const PING_URL =
  process.env.KEEPALIVE_PING_URL ||
  process.env.KEEPALIVE_URL ||
  process.env.RENDER_KEEPALIVE_URL ||
  'https://gatorvault-api.onrender.com/api/ping';

const API_ORIGIN = process.env.KEEPALIVE_API_ORIGIN || 'https://gatorvault-api.onrender.com';

/** Fan-facing first paint — touch these before the rest so launch traffic stays hot. */
const PRIORITY_TOUCH_PATHS = (
  process.env.KEEPALIVE_PRIORITY_TOUCH_PATHS ||
  [
    '/api/recruiting/hub/bundle?year=2027',
    '/api/recruiting/hub/bundle?year=2028',
    '/api/roster/players',
    '/api/live/dashboard?limit=10',
    '/api/staff/dashboard',
    '/api/futurecast/home',
    // Lab Closing Class — cold rebuild is ~10s; keep this in priority so first open is warm.
    '/api/futurecast/high-priority?year=2027',
    '/api/futurecast/high-priority?year=2028',
  ].join(',')
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const TOUCH_PATHS = (
  process.env.KEEPALIVE_TOUCH_PATHS ||
  [
    '/api/recruiting/movement-intel',
    '/api/recruiting/intel/beat?limit=5',
    '/api/live/podcasts',
    '/api/live/ticker',
    '/api/film-room/catalog',
    '/api/betting/lines',
    '/api/articles/published?limit=5',
    '/api/futurecast/alerts?limit=10',
    '/api/community/categories',
    '/api/community/threads?sort=trending&limit=12',
    '/api/nil/dashboard',
  ].join(',')
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const RETRY_STATUSES = new Set([502, 503, 504, 429]);
const WAKE_WINDOW_MS = parseInt(process.env.KEEPALIVE_WAKE_MS || '180000', 10);
const WAKE_INTERVAL_MS = parseInt(process.env.KEEPALIVE_WAKE_INTERVAL_MS || '5000', 10);
const REQUEST_TIMEOUT_MS = parseInt(process.env.KEEPALIVE_TIMEOUT_MS || '90000', 10);
const HUB_TIMEOUT_MS = parseInt(process.env.KEEPALIVE_HUB_TIMEOUT_MS || '45000', 10);
const TOUCH_CONCURRENCY = Math.max(
  1,
  parseInt(process.env.KEEPALIVE_TOUCH_CONCURRENCY || '5', 10) || 5
);

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function pingOnce(url, timeoutMs = REQUEST_TIMEOUT_MS) {
  const started = Date.now();
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json', 'User-Agent': 'gatorvault-keepalive/3.3' },
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

async function softTouch(path) {
  const url = path.startsWith('http') ? path : `${API_ORIGIN}${path}`;
  try {
    const result = await pingOnce(url, HUB_TIMEOUT_MS);
    return { path, ok: result.ok, status: result.status, elapsedMs: result.elapsed };
  } catch (err) {
    return { path, ok: false, error: String(err.message || err).slice(0, 120) };
  }
}

async function mapPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const idx = next;
      next += 1;
      results[idx] = await worker(items[idx], idx);
    }
  }
  const n = Math.min(concurrency, Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => run()));
  return results;
}

async function main() {
  const ping = await wakeUntilReady(PING_URL, 'api/ping');
  let touches = [];
  if (process.env.KEEPALIVE_HUB_TOUCH !== 'false') {
    // Priority first (hubs/roster/live/staff) so cold opens hit warm caches.
    const priority = await mapPool(
      PRIORITY_TOUCH_PATHS,
      Math.min(TOUCH_CONCURRENCY, Math.max(2, PRIORITY_TOUCH_PATHS.length)),
      (path) => softTouch(path)
    );
    const secondary = await mapPool(TOUCH_PATHS, TOUCH_CONCURRENCY, (path) => softTouch(path));
    touches = [...priority, ...secondary];
  }
  const okCount = touches.filter((t) => t && t.ok).length;
  console.log(
    '[keepalive] ok',
    JSON.stringify({
      ping,
      touchOk: okCount,
      touchTotal: touches.length,
      priorityCount: PRIORITY_TOUCH_PATHS.length,
      touches,
      at: new Date().toISOString(),
    })
  );
}

(async () => {
  try {
    await main();
  } catch (err) {
    console.error('[keepalive] failed:', err.message);
  }
  process.exit(0);
})();
