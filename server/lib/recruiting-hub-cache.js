/**
 * Recruiting Hub elite cache — prebuild on deploy, building fallback on cold miss.
 */
const fs = require('fs');
const path = require('path');
const { createMemoryCache } = require('./memory-cache');

const HUB_SNAPSHOT_DIR = path.join(__dirname, '..', 'hub-snapshot');

/** Bump when HS-only class commit metrics logic changes. */
const HUB_METRICS_CACHE_REV = 'hs5';

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

function eliteBundleCacheKey(year) {
  return `hub:elite:bundle:${HUB_METRICS_CACHE_REV}:${year}`;
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]);
}

/** Static hub-snapshot JSON from deploy build — instant response on cold cache miss. */
function readHubDiskSnapshot(endpoint, year) {
  if (!endpoint) return null;
  try {
    const filePath =
      endpoint === 'class-overview-all'
        ? path.join(HUB_SNAPSHOT_DIR, 'class-overview-all.json')
        : year != null
          ? path.join(HUB_SNAPSHOT_DIR, String(year), `${endpoint}.json`)
          : null;
    if (!filePath || !fs.existsSync(filePath)) return null;
    const doc = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!doc || doc.ok === false) return null;
    const { ok, status, meta, items, ...spreadRest } = doc;
    if (endpoint === 'class-overview' || endpoint === 'class-overview-all' || endpoint === 'footprint') {
      return Object.keys(spreadRest).length ? spreadRest : null;
    }
    return items ?? spreadRest ?? null;
  } catch {
    return null;
  }
}

function getHubStatus() {
  // Once priority caches are hot, report ready even if a background refresh is running.
  // Stuck secondary warm was leaving status="warming" for minutes and slowing first paint UX.
  if (ready) return 'ready';
  if (warming) return 'warming';
  return 'building';
}

function getMeta() {
  const meta = {
    ready: isReady(),
    status: getHubStatus(),
    warming: warming && !ready,
    lastWarmAt,
    lastRefresh: lastWarmAt,
    lastWarmError,
    warmKeyCount,
    cacheSize: warmKeyCount,
    cacheTtlMs: HUB_CACHE_MS,
    buildTimeoutMs: BUILD_TIMEOUT_MS,
  };
  // Cheap snapshot for /ready probe — avoids require()+I/O on the health path.
  try {
    global.__GV_HUB_META__ = meta;
  } catch {
    /* ignore */
  }
  return meta;
}

function isReady() {
  return ready;
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

/** Fan-facing first paint — warm these before the rest of the elite map. */
function priorityWarmJobs(elite, years) {
  const jobs = [
    [eliteClassOverviewAllCacheKey(), () => elite.buildHubClassOverviewAll()],
    // FutureCast Lab critical path — keep master-board / trending hot at boot.
    [
      'futurecast:lab:elite-warm',
      async () => {
        const { warmFuturecastLabCaches } = require('../api/futurecast/response-cache.ts');
        return warmFuturecastLabCaches([2027, 2028]);
      },
    ],
  ];
  for (const year of years) {
    jobs.push([eliteClassOverviewCacheKey(year), () => elite.buildHubClassOverview(year)]);
    jobs.push([classSnapshotCacheKey(year), () => elite.buildHubClassOverview(year)]);
    jobs.push([`hub:elite:hero:${year}`, () => elite.buildHubHero(year)]);
    jobs.push([eliteBundleCacheKey(year), () => elite.buildHubBundle(year)]);
  }
  return jobs;
}

function secondaryWarmJobs(elite, years) {
  const jobs = [
    [
      'hub:intel:high-priority',
      async () => {
        const gm2 = require('./gm2');
        const intelStore = require('./recruiting-intel-store');
        if (typeof intelStore.initIntelStore === 'function') {
          await intelStore.initIntelStore().catch(() => {});
        }
        return gm2.getPublicIntel({ limit: 50, subsystem: 'recruiting-hub' }).intel ?? [];
      },
    ],
    [
      'recruiting:movement',
      () => {
        const { buildRecruitingMovementIntelPayload } = require('../api/recruiting/movement-intel.ts');
        return buildRecruitingMovementIntelPayload();
      },
    ],
    [
      'hub:intel:beat',
      () => {
        const { buildBeatIntelItems } = require('./recruiting-ui-api');
        return buildBeatIntelItems(5);
      },
    ],
  ];

  for (const year of years) {
    jobs.push([`recruiting:battles:${year}`, () => elite.buildHubBattleBoard(year)]);
    jobs.push([
      `recruiting:battles-and-movement:${year}`,
      () => {
        const { buildBattlesAndMovement } = require('./recruiting-ui-api');
        return buildBattlesAndMovement(year);
      },
    ]);
    jobs.push([`recruiting:heat-index:${year}`, () => elite.buildHubHeatIndex(year)]);
    jobs.push([`recruiting:positions:v2:${year}`, () => elite.buildHubPositions(year)]);
    jobs.push([`recruiting:footprint:${year}`, () => elite.buildHubFootprint(year)]);
    jobs.push([`hub:elite:ticker:${year}`, () => elite.buildHubTicker(year)]);
    jobs.push([`hub:elite:commits:${year}`, () => elite.buildHubCommits(year)]);
    jobs.push([`hub:elite:battles:${year}`, () => elite.buildHubBattles(year)]);
    jobs.push([`hub:elite:positions:v2:${year}`, () => elite.buildHubPositions(year)]);
    jobs.push([`hub:elite:heat-index:${year}`, () => elite.buildHubHeatIndex(year)]);
    jobs.push([`hub:elite:movement-feed:v3:${year}`, () => elite.buildHubMovementFeed(year)]);
    jobs.push([`hub:elite:battle-board:${year}`, () => elite.buildHubBattleBoard(year)]);
    jobs.push([`hub:elite:footprint:${year}`, () => elite.buildHubFootprint(year)]);
  }
  return jobs;
}

async function runWarmJobBatch(jobs, timeoutMs, label) {
  let warmed = 0;
  for (const [key, fn] of jobs) {
    try {
      const value = await withTimeout(fn(), timeoutMs, key);
      hubCache.set(key, value);
      warmed += 1;
      ready = true;
      warmKeyCount = Math.max(warmKeyCount, warmed);
    } catch (err) {
      console.warn(`[recruiting-hub-cache] ${label} skip`, key, err.message);
    }
  }
  return warmed;
}

async function warmEliteHubCaches(options = {}) {
  if (warming) return getMeta();
  warming = true;
  lastWarmError = null;
  const years = options.years || DEFAULT_YEARS;
  const priorityOnly = options.priorityOnly === true;
  const secondaryOnly = options.secondaryOnly === true;
  const start = Date.now();
  let warmed = 0;

  try {
    const elite = require('./recruiting-hub-elite');
    const priorityTimeout = Math.max(BUILD_TIMEOUT_MS * 3, 60_000);

    if (!secondaryOnly) {
      const priorityWarmed = await runWarmJobBatch(
        priorityWarmJobs(elite, years),
        priorityTimeout,
        'priority'
      );
      warmed += priorityWarmed;
      warmKeyCount = Math.max(warmKeyCount, warmed);
      ready = warmKeyCount > 0;
      if (priorityWarmed > 0) {
        lastWarmAt = new Date().toISOString();
        console.log(
          '[recruiting-hub-cache] priority warm ready:',
          priorityWarmed,
          'keys in',
          Date.now() - start,
          'ms'
        );
      }
      // Unblock fan-facing "warming" status before slower secondary jobs finish.
      warming = false;
    }

    if (!priorityOnly) {
      const secondaryWarmed = await runWarmJobBatch(
        secondaryWarmJobs(elite, years),
        BUILD_TIMEOUT_MS * 2,
        'secondary'
      );
      warmed += secondaryWarmed;
    }

    warmKeyCount = Math.max(warmKeyCount, warmed);
    ready = warmKeyCount > 0;
    if (warmed > 0 || ready) {
      lastWarmAt = new Date().toISOString();
    }
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
  if (options.force) {
    hubCache.remove(cacheKey);
  }
  const hit = options.force ? null : hubCache.get(cacheKey);
  if (hit != null) {
    return { status: 'ready', value: hit, hit: true, stale: false };
  }

  const stale = hubCache.getStale(cacheKey);
  if (stale != null) {
    refreshCacheKey(cacheKey, builderFn, timeoutMs);
    return { status: 'ready', value: stale, hit: true, stale: true };
  }

  const diskFallback = options.diskFallback;
  if (diskFallback?.endpoint) {
    const diskValue = readHubDiskSnapshot(diskFallback.endpoint, diskFallback.year);
    if (diskValue != null) {
      refreshCacheKey(cacheKey, builderFn, timeoutMs);
      return { status: 'ready', value: diskValue, hit: true, stale: true, diskSnapshot: true };
    }
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

async function sendHubJson(res, { cacheKey, year, endpoint, builder, spread = false, hubMeta, timeoutMs, force = false }) {
  const result = await serveCached(cacheKey, builder, {
    timeoutMs,
    force,
    diskFallback: endpoint ? { endpoint, year } : null,
  });
  if (result.status === 'building') {
    return res.status(200).json(buildingResponse({ endpoint, year, cacheKey }));
  }

  const meta = hubMeta({
    cacheKey,
    hubReady: isReady(),
    cacheHit: result.hit,
    cacheStale: result.stale ?? false,
    ...(result.diskSnapshot ? { diskSnapshot: true } : {}),
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
    try {
      const pipelineGuards = require('./pipeline-guards');
      if (pipelineGuards.shouldSkipHeavyJob('hub-background-warm')) return;
    } catch {
      /* optional */
    }
    warmEliteHubCaches().catch((err) => {
      console.warn('[recruiting-hub-cache] background refresh failed:', err.message);
    });
  }, REFRESH_MS);
  if (typeof refreshTimer.unref === 'function') refreshTimer.unref();
}

function scheduleHubBootPipeline() {
  const pipelineGuards = require('./pipeline-guards');
  if (process.env.HUB_BOOT_SKIP_WARM === 'true') {
    console.log('[recruiting-hub] boot pipeline skipped (HUB_BOOT_SKIP_WARM=true) — rely on hub-refresh cron');
    return;
  }

  // Hub warm is fan-facing infrastructure — do NOT gate on X_SCHEDULED_JOBS_ENABLED.
  const bootDelay = parseInt(process.env.HUB_BOOT_WARM_DELAY_MS || '0', 10);
  const immediateWarm = process.env.HUB_BOOT_IMMEDIATE_WARM !== 'false';
  // Starter can OOM on full warm; priority hero/bundle/class keys first (higher RSS ceiling).
  const priorityRssLimit = parseInt(process.env.HUB_PRIORITY_WARM_RSS_MB || '520', 10) || 520;

  const runPriorityWarm = () => {
    if (pipelineGuards.shouldSkipHeavyJob('hub-boot-priority-warm', priorityRssLimit)) return;
    warmEliteHubCaches({ priorityOnly: true })
      .then(() => {
        if (pipelineGuards.shouldSkipHeavyJob('hub-boot-warm', priorityRssLimit)) return;
        return warmEliteHubCaches({ secondaryOnly: true });
      })
      .catch((err) => {
        console.warn('[recruiting-hub-cache] boot warm failed:', err.message);
      });
  };

  if (immediateWarm) {
    setImmediate(runPriorityWarm);
  } else {
    setTimeout(runPriorityWarm, Math.max(bootDelay, 15_000));
  }

  // Heavy geo refresh stays optional / scheduled-jobs gated (not required for first paint).
  const refreshDelay = Math.max(
    bootDelay + 120000,
    parseInt(process.env.HUB_BOOT_REFRESH_DELAY_MS || String(bootDelay + 120000), 10) || bootDelay + 120000
  );
  if (pipelineGuards.scheduledJobsEnabled()) {
    setTimeout(() => {
      if (pipelineGuards.shouldSkipHeavyJob('hub-boot-refresh')) return;
      const { refreshRecruitingHubCaches } = require('./recruiting-hub-refresh');
      const geoBackfill = process.env.HUB_BOOT_GEO_BACKFILL === 'true';
      refreshRecruitingHubCaches({ geoBackfill, warmAfter: false })
        .then((result) => {
          console.log('[recruiting-hub] boot refresh complete:', result.enrichedPlayerCount, 'players');
        })
        .catch((err) => {
          console.warn('[recruiting-hub] boot refresh failed:', err.message);
        });
    }, refreshDelay);
  } else {
    console.log('[recruiting-hub] boot geo refresh skipped — X_SCHEDULED_JOBS_ENABLED is not true');
  }

  scheduleBackgroundRefresh();
  console.log(
    '[recruiting-hub] boot warm',
    immediateWarm ? 'immediate-priority' : 'deferred-priority',
    '; refresh pipeline in',
    pipelineGuards.scheduledJobsEnabled() ? refreshDelay : 'skipped',
    'ms; background every',
    REFRESH_MS,
    'ms'
  );
}

module.exports = {
  hubCache,
  HUB_CACHE_MS,
  HUB_METRICS_CACHE_REV,
  classSnapshotCacheKey,
  eliteClassOverviewCacheKey,
  eliteClassOverviewAllCacheKey,
  eliteBundleCacheKey,
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
  readHubDiskSnapshot,
};
