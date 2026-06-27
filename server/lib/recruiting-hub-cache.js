/**
 * Recruiting Hub elite cache — prebuild on deploy, building fallback on cold miss.
 */
const { createMemoryCache } = require('./memory-cache');

/** Bump when HS-only class commit metrics logic changes. */
const HUB_METRICS_CACHE_REV = 'hs1';

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

function classSnapshotCacheKey(year) {
  return `hub:class:snapshot:${HUB_METRICS_CACHE_REV}:${year}`;
}

function eliteClassOverviewCacheKey(year) {
  return `hub:elite:class-overview:${HUB_METRICS_CACHE_REV}:${year}`;
}

function eliteClassOverviewAllCacheKey() {
  return `hub:elite:class-overview:${HUB_METRICS_CACHE_REV}:all`;
}

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

function removeHubCacheKeys(keys) {
  if (!Array.isArray(keys) || !keys.length) return 0;
  let removed = 0;
  for (const key of keys) {
    if (key) {
      hubCache.remove(key);
      removed += 1;
    }
  }
  if (removed > 0 && warmKeyCount > 0) {
    warmKeyCount = Math.max(0, warmKeyCount - removed);
  }
  return removed;
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
      [eliteClassOverviewAllCacheKey(), () => elite.buildHubClassOverviewAll(), null],
      ['hub:intel:high-priority', async () => {
        const gm2 = require('./gm2');
        const intelStore = require('./recruiting-intel-store');
        if (typeof intelStore.initIntelStore === 'function') {
          await intelStore.initIntelStore().catch(() => {});
        }
        return gm2.getPublicIntel({ limit: 50, subsystem: 'recruiting-hub' }).intel ?? [];
      }, null],
      ['recruiting:movement', () => {
        const { buildRecruitingMovementIntelPayload } = require('../api/recruiting/movement-intel.ts');
        return buildRecruitingMovementIntelPayload();
      }, null],
      ['hub:intel:beat', () => {
        const { buildBeatIntelItems } = require('./recruiting-ui-api');
        return buildBeatIntelItems(5);
      }, null],
    ];

    for (const year of years) {
      jobs.push([classSnapshotCacheKey(year), () => elite.buildHubClassOverview(year), year]);
      jobs.push([`recruiting:battles:${year}`, () => elite.buildHubBattleBoard(year), year]);
      jobs.push([`recruiting:battles-and-movement:${year}`, () => {
        const { buildBattlesAndMovement } = require('./recruiting-ui-api');
        return buildBattlesAndMovement(year);
      }, year]);
      jobs.push([`recruiting:heat-index:${year}`, () => elite.buildHubHeatIndex(year), year]);
      jobs.push([`recruiting:positions:${year}`, () => elite.buildHubPositions(year), year]);
      jobs.push([`recruiting:footprint:${year}`, () => elite.buildHubFootprint(year), year]);
      jobs.push([`hub:elite:bundle:${year}`, () => elite.buildHubBundle(year), year]);
      jobs.push([`hub:elite:hero:${year}`, () => elite.buildHubHero(year), year]);
      jobs.push([`hub:elite:ticker:${year}`, () => elite.buildHubTicker(year), year]);
      jobs.push([eliteClassOverviewCacheKey(year), () => elite.buildHubClassOverview(year), year]);
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
  HUB_METRICS_CACHE_REV,
  classSnapshotCacheKey,
  eliteClassOverviewCacheKey,
  eliteClassOverviewAllCacheKey,
  clearHubCache,
  removeHubCacheKeys,
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
