/**
 * Recruiting Hub elite cache — prebuild on deploy, building fallback on cold miss.
 */
const { createMemoryCache } = require('./memory-cache');

const HUB_CACHE_MS = parseInt(process.env.HUB_CACHE_MS || String(5 * 60 * 1000), 10);
const BUILD_TIMEOUT_MS = parseInt(process.env.HUB_BUILD_TIMEOUT_MS || '20000', 10);
const REFRESH_MS = parseInt(process.env.HUB_CACHE_REFRESH_MS || String(Math.max(HUB_CACHE_MS - 60_000, 120_000)), 10);
const DEFAULT_YEARS = String(process.env.HUB_WARM_YEARS || '2026,2027,2028,2029')
  .split(',')
  .map((y) => parseInt(y.trim(), 10))
  .filter((y) => Number.isFinite(y));

const hubCache = createMemoryCache(HUB_CACHE_MS);

let warming = false;
let ready = false;
let lastWarmAt = null;
let lastWarmError = null;
let warmKeyCount = 0;
let refreshTimer = null;
const inflightBuilds = new Map();

function withTimeout(promise, ms, label) {
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]);
}

function getHubStatus() {
  if (warming) return 'warming';
  if (ready) return 'ready';
  return 'building';
}

function getMeta() {
  return {
    ready,
    status: getHubStatus(),
    warming,
    lastWarmAt,
    lastRefresh: lastWarmAt,
    lastWarmError,
    warmKeyCount,
    cacheSize: warmKeyCount,
    cacheTtlMs: HUB_CACHE_MS,
    buildTimeoutMs: BUILD_TIMEOUT_MS,
  };
}

function isReady() {
  return ready && !warming;
}

function buildingResponse({ endpoint, year, cacheKey, metaExtra = {} }) {
  const now = new Date().toISOString();
  return {
    ok: true,
    status: 'building',
    meta: {
      generatedAt: now,
      lastUpdated: now,
      cacheKey,
      endpoint,
      year: year ?? null,
      cacheReason: warming ? 'warming' : 'cache_miss',
      hubReady: ready,
      ...metaExtra,
    },
    items: [],
  };
}

function clearHubCache() {
  hubCache.clear();
  ready = false;
  warmKeyCount = 0;
  lastWarmError = null;
}

async function warmEliteHubCaches(options = {}) {
  if (warming) return getMeta();
  warming = true;
  lastWarmError = null;
  const years = options.years || DEFAULT_YEARS;
  const start = Date.now();
  let warmed = 0;

  try {
    const elite = require('./recruiting-hub-elite');
    const jobs = [
      ['hub:elite:class-overview:all', () => elite.buildHubClassOverviewAll(), null],
    ];

    for (const year of years) {
      jobs.push([`hub:elite:bundle:${year}`, () => elite.buildHubBundle(year), year]);
      jobs.push([`hub:elite:ticker:${year}`, () => elite.buildHubTicker(year), year]);
      jobs.push([`hub:elite:class-overview:${year}`, () => elite.buildHubClassOverview(year), year]);
      jobs.push([`hub:elite:commits:${year}`, () => elite.buildHubCommits(year), year]);
      jobs.push([`hub:elite:battles:${year}`, () => elite.buildHubBattles(year), year]);
      jobs.push([`hub:elite:positions:${year}`, () => elite.buildHubPositions(year), year]);
      jobs.push([`hub:elite:heat-index:${year}`, () => elite.buildHubHeatIndex(year), year]);
      jobs.push([`hub:elite:movement-feed:${year}`, () => elite.buildHubMovementFeed(year), year]);
      jobs.push([`hub:elite:battle-board:${year}`, () => elite.buildHubBattleBoard(year), year]);
      jobs.push([`hub:elite:footprint:${year}`, () => elite.buildHubFootprint(year), year]);
    }

    for (const [key, fn] of jobs) {
      try {
        const value = await withTimeout(fn(), BUILD_TIMEOUT_MS * 2, key);
        hubCache.set(key, value);
        warmed += 1;
      } catch (err) {
        console.warn('[recruiting-hub-cache] warm skip', key, err.message);
      }
    }

    warmKeyCount = warmed;
    ready = warmed > 0;
    lastWarmAt = new Date().toISOString();
    console.log(
      '[recruiting-hub-cache] warm complete:',
      warmed,
      'keys in',
      Date.now() - start,
      'ms'
    );
  } catch (err) {
    lastWarmError = err.message;
    console.warn('[recruiting-hub-cache] warm failed:', err.message);
  } finally {
    warming = false;
  }

  return getMeta();
}

function scheduleAsyncWarm() {
  if (warming) return;
  setImmediate(() => {
    warmEliteHubCaches().catch((err) => {
      console.warn('[recruiting-hub-cache] async warm failed:', err.message);
    });
  });
}

function startInflightBuild(cacheKey, builderFn, timeoutMs) {
  const existing = inflightBuilds.get(cacheKey);
  if (existing) return existing;

  const buildPromise = (async () => {
    const buildStart = Date.now();
    try {
      const value = await withTimeout(builderFn(), timeoutMs, cacheKey);
      const buildMs = Date.now() - buildStart;
      hubCache.set(cacheKey, value);
      ready = true;
      warmKeyCount += 1;
      console.log(`[recruiting-hub-cache] build ${cacheKey} ${buildMs}ms hit=false`);
      return { value, buildMs };
    } finally {
      inflightBuilds.delete(cacheKey);
    }
  })();

  inflightBuilds.set(cacheKey, buildPromise);
  return buildPromise;
}

async function serveCached(cacheKey, builderFn, options = {}) {
  const timeoutMs = options.timeoutMs ?? BUILD_TIMEOUT_MS;
  const hit = hubCache.get(cacheKey);
  if (hit != null) {
    return { status: 'ready', value: hit, hit: true, stale: false };
  }

  const stale = hubCache.getStale(cacheKey);
  if (stale != null) {
    refreshCacheKey(cacheKey, builderFn, timeoutMs);
    return { status: 'ready', value: stale, hit: true, stale: true };
  }

  const inflight = inflightBuilds.get(cacheKey);
  if (inflight) {
    try {
      const { value, buildMs } = await withTimeout(inflight, timeoutMs, cacheKey);
      return { status: 'ready', value, hit: false, stale: false, buildMs };
    } catch (err) {
      console.warn('[recruiting-hub-cache] build timeout/miss', cacheKey, err.message);
      scheduleAsyncWarm();
      return { status: 'building', hit: false, reason: err.message };
    }
  }

  if (warming) {
    return { status: 'building', hit: false };
  }

  try {
    const { value, buildMs } = await startInflightBuild(cacheKey, builderFn, timeoutMs);
    return { status: 'ready', value, hit: false, stale: false, buildMs };
  } catch (err) {
    console.warn('[recruiting-hub-cache] build timeout/miss', cacheKey, err.message);
    scheduleAsyncWarm();
    return { status: 'building', hit: false, reason: err.message };
  }
}

function refreshCacheKey(cacheKey, builderFn, timeoutMs = BUILD_TIMEOUT_MS) {
  if (warming) return;
  setImmediate(() => {
    withTimeout(builderFn(), timeoutMs, cacheKey)
      .then((value) => {
        hubCache.set(cacheKey, value);
        ready = true;
      })
      .catch((err) => {
        console.warn('[recruiting-hub-cache] background refresh failed', cacheKey, err.message);
      });
  });
}

async function sendHubJson(res, { cacheKey, year, endpoint, builder, spread = false, hubMeta, timeoutMs }) {
  const result = await serveCached(cacheKey, builder, { timeoutMs });
  if (result.status === 'building') {
    return res.status(200).json(buildingResponse({ endpoint, year, cacheKey }));
  }

  const meta = hubMeta({
    cacheKey,
    hubReady: isReady(),
    cacheHit: result.hit,
    cacheStale: result.stale ?? false,
    ...(result.buildMs != null ? { buildMs: result.buildMs } : {}),
  });
  if (spread) {
    return res.json({ ok: true, status: 'ready', meta, ...result.value });
  }
  return res.json({ ok: true, status: 'ready', meta, items: result.value });
}

function scheduleBackgroundRefresh() {
  if (refreshTimer) return;
  refreshTimer = setInterval(() => {
    warmEliteHubCaches().catch((err) => {
      console.warn('[recruiting-hub-cache] background refresh failed:', err.message);
    });
  }, REFRESH_MS);
  if (typeof refreshTimer.unref === 'function') refreshTimer.unref();
}

function scheduleHubBootPipeline() {
  const bootDelay = parseInt(process.env.HUB_BOOT_WARM_DELAY_MS || '0', 10);
  setImmediate(() => {
    warmEliteHubCaches().catch((err) => {
      console.warn('[recruiting-hub-cache] boot warm failed:', err.message);
    });
  });
  setTimeout(() => {
    const { refreshRecruitingHubCaches } = require('./recruiting-hub-refresh');
    const geoBackfill = process.env.HUB_BOOT_GEO_BACKFILL === 'true';
    refreshRecruitingHubCaches({ geoBackfill, warmAfter: true })
      .then((result) => {
        console.log('[recruiting-hub] boot refresh complete:', result.enrichedPlayerCount, 'players');
      })
      .catch((err) => {
        console.warn('[recruiting-hub] boot refresh failed:', err.message);
        return warmEliteHubCaches();
      });
  }, bootDelay);
  scheduleBackgroundRefresh();
  console.log('[recruiting-hub] boot warm immediate; refresh pipeline in', bootDelay, 'ms; background every', REFRESH_MS, 'ms');
}

module.exports = {
  hubCache,
  HUB_CACHE_MS,
  clearHubCache,
  warmEliteHubCaches,
  scheduleAsyncWarm,
  serveCached,
  sendHubJson,
  buildingResponse,
  isReady,
  getMeta,
  scheduleBackgroundRefresh,
  scheduleHubBootPipeline,
};
