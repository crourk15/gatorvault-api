/**
 * Recruiting Hub elite cache — prebuild on deploy, building fallback on cold miss.
 * Tier B: member GETs never sync-rebuild (disk + SWR + background warm only).
 */
const fs = require('fs');
const path = require('path');
const { createMemoryCache } = require('./memory-cache');
const { resolveRecruitingDataDir } = require('./recruiting-data-dir');

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

/** Default ON: never await a cold hub rebuild on the request path. */
function hubGetNoSyncBuild() {
  return process.env.HUB_GET_NO_SYNC_BUILD !== 'false';
}

const hubCache = createMemoryCache(HUB_CACHE_MS);

/** Endpoints persisted under durable hub-runtime (survives process restart). */
const DURABLE_SPREAD_ENDPOINTS = new Set([
  'bundle',
  'hero',
  'class-overview',
  'class-overview-all',
  'footprint',
  'class-metrics',
]);
const DURABLE_ITEMS_ENDPOINTS = new Set(['commits', 'ticker']);

let warming = false;
let warmInflight = null;
let ready = false;
let lastWarmAt = null;
let lastWarmError = null;
let warmKeyCount = 0;
let refreshTimer = null;
/** @type {null | Record<string, unknown>} */
let bootWarmDecision = null;
let bootPipelineScheduled = false;
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
  let timer = null;
  return new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    if (typeof timer.unref === 'function') timer.unref();
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function runtimeSnapshotRoot() {
  return path.join(resolveRecruitingDataDir(), 'hub-runtime');
}

function snapshotFileCandidates(endpoint, year) {
  const diskName =
    endpoint === 'class-metrics' ? 'class-overview' : endpoint;
  const roots = [runtimeSnapshotRoot(), HUB_SNAPSHOT_DIR];
  const paths = [];
  for (const root of roots) {
    if (diskName === 'class-overview-all') {
      paths.push(path.join(root, 'class-overview-all.json'));
    } else if (year != null) {
      paths.push(path.join(root, String(year), `${diskName}.json`));
    }
  }
  return paths;
}

function parseHubSnapshotDoc(endpoint, doc) {
  if (!doc || doc.ok === false) return null;
  const { ok, status, meta, items, ...spreadRest } = doc;
  if (
    endpoint === 'class-overview' ||
    endpoint === 'class-overview-all' ||
    endpoint === 'class-metrics' ||
    endpoint === 'footprint' ||
    endpoint === 'bundle' ||
    endpoint === 'hero'
  ) {
    return Object.keys(spreadRest).length ? spreadRest : null;
  }
  return items ?? (Object.keys(spreadRest).length ? spreadRest : null);
}

/** Runtime hub-runtime first, then static deploy hub-snapshot — cold miss without rebuild. */
function readHubDiskSnapshot(endpoint, year) {
  if (!endpoint) return null;
  for (const filePath of snapshotFileCandidates(endpoint, year)) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const doc = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const value = parseHubSnapshotDoc(endpoint, doc);
      if (value != null) return value;
    } catch {
      /* try next */
    }
  }
  return null;
}

function writeHubDiskSnapshot(endpoint, year, value) {
  if (!endpoint || value == null) return false;
  const diskName =
    endpoint === 'class-metrics' ? 'class-overview' : endpoint;
  const isSpread =
    DURABLE_SPREAD_ENDPOINTS.has(endpoint) || DURABLE_SPREAD_ENDPOINTS.has(diskName);
  const isItems = DURABLE_ITEMS_ENDPOINTS.has(endpoint) || DURABLE_ITEMS_ENDPOINTS.has(diskName);
  if (!isSpread && !isItems) return false;
  try {
    const root = runtimeSnapshotRoot();
    const filePath =
      diskName === 'class-overview-all'
        ? path.join(root, 'class-overview-all.json')
        : year != null
          ? path.join(root, String(year), `${diskName}.json`)
          : null;
    if (!filePath) return false;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const meta = {
      generatedAt: new Date().toISOString(),
      snapshot: true,
      endpoint: diskName,
      year: year ?? null,
      source: 'hub-runtime',
    };
    const doc = isSpread
      ? { ok: true, status: 'ready', meta, ...value }
      : { ok: true, status: 'ready', meta, items: value };
    fs.writeFileSync(filePath, JSON.stringify(doc), 'utf8');
    return true;
  } catch (err) {
    console.warn('[recruiting-hub-cache] disk snapshot write failed', endpoint, err.message);
    return false;
  }
}

/** Map warm/serve cache keys → durable disk endpoint (+ year). */
function durableMetaForCacheKey(cacheKey) {
  if (!cacheKey || typeof cacheKey !== 'string') return null;
  let m = cacheKey.match(/^hub:elite:bundle:[^:]+:(\d+)$/);
  if (m) return { endpoint: 'bundle', year: Number(m[1]), spread: true };
  m = cacheKey.match(/^hub:elite:hero:(\d+)$/);
  if (m) return { endpoint: 'hero', year: Number(m[1]), spread: true };
  m = cacheKey.match(/^hub:elite:class-overview:[^:]+:(\d+)$/);
  if (m) return { endpoint: 'class-overview', year: Number(m[1]), spread: true };
  if (cacheKey === eliteClassOverviewAllCacheKey()) {
    return { endpoint: 'class-overview-all', year: null, spread: true };
  }
  m = cacheKey.match(/^hub:class:snapshot:[^:]+:(\d+)$/);
  if (m) return { endpoint: 'class-metrics', year: Number(m[1]), spread: true };
  m = cacheKey.match(/^hub:elite:commits:v3:(\d+)$/);
  if (m) return { endpoint: 'commits', year: Number(m[1]), spread: false };
  m = cacheKey.match(/^hub:elite:ticker:(\d+)$/);
  if (m) return { endpoint: 'ticker', year: Number(m[1]), spread: false };
  return null;
}

function persistDurableCacheValue(cacheKey, value) {
  const meta = durableMetaForCacheKey(cacheKey);
  if (!meta) return false;
  return writeHubDiskSnapshot(meta.endpoint, meta.year, value);
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
    bootWarm: bootWarmDecision,
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

/**
 * Lite first-paint warm — class overview + hero only.
 * Full hub bundle is separate: buildHubBundle Promise.all was OOMing Render on boot.
 */
function priorityLiteWarmJobs(elite, years) {
  const jobs = [
    [eliteClassOverviewAllCacheKey(), () => elite.buildHubClassOverviewAll()],
  ];
  for (const year of years) {
    jobs.push([eliteClassOverviewCacheKey(year), () => elite.buildHubClassOverview(year)]);
    jobs.push([classSnapshotCacheKey(year), () => elite.buildHubClassOverview(year)]);
    jobs.push([`hub:elite:hero:${year}`, () => elite.buildHubHero(year)]);
  }
  return jobs;
}

function bundleWarmJobs(elite, years) {
  const jobs = [];
  for (const year of years) {
    jobs.push([eliteBundleCacheKey(year), () => elite.buildHubBundle(year)]);
  }
  return jobs;
}

/** Fan-facing first paint — lite keys, then optional FutureCast marker job. */
function priorityWarmJobs(elite, years, { includeBundle = true } = {}) {
  const jobs = priorityLiteWarmJobs(elite, years);
  // FutureCast Lab warm is heavy — keep OFF priority unless explicitly enabled.
  if (process.env.HUB_BOOT_WARM_FUTURECAST === 'true') {
    jobs.push([
      'futurecast:lab:elite-warm',
      async () => {
        const { warmFuturecastLabCaches } = require('../api/futurecast/response-cache.ts');
        return warmFuturecastLabCaches([2027, 2028]);
      },
    ]);
  }
  if (includeBundle) {
    jobs.push(...bundleWarmJobs(elite, years));
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
    jobs.push([`hub:elite:commits:v3:${year}`, () => elite.buildHubCommits(year)]);
    jobs.push([`hub:elite:battles:${year}`, () => elite.buildHubBattles(year)]);
    jobs.push([`hub:elite:positions:v2:${year}`, () => elite.buildHubPositions(year)]);
    jobs.push([`hub:elite:heat-index:${year}`, () => elite.buildHubHeatIndex(year)]);
    jobs.push([`hub:elite:movement-feed:v3:${year}`, () => elite.buildHubMovementFeed(year)]);
    jobs.push([`hub:elite:battle-board:${year}`, () => elite.buildHubBattleBoard(year)]);
    jobs.push([`hub:elite:footprint:${year}`, () => elite.buildHubFootprint(year)]);
  }
  return jobs;
}

function yieldEventLoop() {
  return new Promise((resolve) => setImmediate(resolve));
}

async function runWarmJobBatch(jobs, timeoutMs, label) {
  let warmed = 0;
  for (const [key, fn] of jobs) {
    try {
      const value = await withTimeout(fn(), timeoutMs, key);
      hubCache.set(key, value);
      persistDurableCacheValue(key, value);
      warmed += 1;
      ready = true;
      warmKeyCount = Math.max(warmKeyCount, warmed);
      // Publish for /ready cheap probe (global.__GV_HUB_META__).
      getMeta();
    } catch (err) {
      console.warn(`[recruiting-hub-cache] ${label} skip`, key, err.message);
    }
    // Let Render /health + /ready + /api/login run between heavy builds.
    await yieldEventLoop();
  }
  return warmed;
}

async function warmEliteHubCaches(options = {}) {
  const { runHeavyJob } = require('./heavy-job-gate');
  return runHeavyJob('hub-warm', () => warmEliteHubCachesInner(options));
}

async function warmEliteHubCachesInner(options = {}) {
  if (warmInflight) return warmInflight;

  warming = true;
  lastWarmError = null;
  const years = options.years || DEFAULT_YEARS;
  const priorityOnly = options.priorityOnly === true;
  const secondaryOnly = options.secondaryOnly === true;
  const priorityLite = options.priorityLite === true;
  const bundleOnly = options.bundleOnly === true;
  const start = Date.now();
  let warmed = 0;

  warmInflight = (async () => {
  try {
    const elite = require('./recruiting-hub-elite');
    const priorityTimeout = Math.max(BUILD_TIMEOUT_MS * 3, 60_000);
    const bundleTimeout = Math.max(
      BUILD_TIMEOUT_MS * 4,
      parseInt(process.env.HUB_BUNDLE_BUILD_TIMEOUT_MS || '45000', 10) || 45000
    );

    if (bundleOnly) {
      const bundleWarmed = await runWarmJobBatch(
        bundleWarmJobs(elite, years),
        bundleTimeout,
        'bundle'
      );
      warmed += bundleWarmed;
      warming = false;
    } else if (!secondaryOnly) {
      // Lite first (hero/class) — never OOM the box before /ready can answer.
      const liteWarmed = await runWarmJobBatch(
        priorityLiteWarmJobs(elite, years),
        priorityTimeout,
        'priority-lite'
      );
      warmed += liteWarmed;
      warmKeyCount = Math.max(warmKeyCount, warmed);
      ready = warmKeyCount > 0;
      if (liteWarmed > 0) {
        lastWarmAt = new Date().toISOString();
        console.log(
          '[recruiting-hub-cache] priority-lite warm ready:',
          liteWarmed,
          'keys in',
          Date.now() - start,
          'ms'
        );
      }

      // Full priority / cron also warms bundles one year at a time after lite.
      if (!priorityLite) {
        const bundleWarmed = await runWarmJobBatch(
          bundleWarmJobs(elite, years),
          bundleTimeout,
          'bundle'
        );
        warmed += bundleWarmed;
      }

      // Unblock fan-facing "warming" status before slower secondary jobs finish.
      warming = false;
    }

    if (!priorityOnly && !priorityLite && !bundleOnly) {
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
    warmInflight = null;
  }

  return getMeta();
  })();

  return warmInflight;
}

let asyncWarmQueued = false;
let lastAsyncWarmAt = 0;
const ASYNC_WARM_DEBOUNCE_MS = parseInt(process.env.HUB_ASYNC_WARM_DEBOUNCE_MS || '120000', 10) || 120000;

/** Debounced priority-only warm — never stampede full rebuilds from member GETs. */
function scheduleAsyncWarm(options = {}) {
  if (warming || asyncWarmQueued) return;
  const now = Date.now();
  if (now - lastAsyncWarmAt < ASYNC_WARM_DEBOUNCE_MS) return;
  asyncWarmQueued = true;
  setImmediate(() => {
    lastAsyncWarmAt = Date.now();
    asyncWarmQueued = false;
    const warmOpts = options.priorityOnly === false ? options : { priorityOnly: true, ...options };
    warmEliteHubCaches(warmOpts).catch((err) => {
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
      persistDurableCacheValue(cacheKey, value);
      ready = true;
      warmKeyCount += 1;
      console.log(`[recruiting-hub-cache] build ${cacheKey} ${buildMs}ms hit=false`);
      return { value, buildMs };
    } finally {
      inflightBuilds.delete(cacheKey);
    }
  })();

  inflightBuilds.set(cacheKey, buildPromise);
  // Tier B GETs fire-and-forget this promise — attach a handler so timeouts
  // do not become unhandledRejection while cron/warm still await the same flight.
  buildPromise.catch((err) => {
    console.warn(
      '[recruiting-hub-cache] inflight build failed',
      cacheKey,
      err && err.message ? err.message : err
    );
  });
  return buildPromise;
}

async function serveCached(cacheKey, builderFn, options = {}) {
  const timeoutMs = options.timeoutMs ?? BUILD_TIMEOUT_MS;
  const noSync = hubGetNoSyncBuild();
  let stayGreen = false;
  try {
    stayGreen = require('./api-stay-green').isStayGreen();
  } catch {
    stayGreen = false;
  }
  if (options.force) {
    hubCache.remove(cacheKey);
  }
  const hit = options.force ? null : hubCache.get(cacheKey);
  if (hit != null) {
    if (!ready) {
      ready = true;
      warmKeyCount = Math.max(warmKeyCount, 1);
      getMeta();
    }
    return { status: 'ready', value: hit, hit: true, stale: false };
  }

  const stale = hubCache.getStale(cacheKey);
  if (stale != null) {
    // Stay-green / no-sync: serve stale only. Do not rebuild from GET — cron owns refill.
    if (!stayGreen && !noSync) refreshCacheKey(cacheKey, builderFn, timeoutMs);
    if (!ready) {
      ready = true;
      warmKeyCount = Math.max(warmKeyCount, 1);
      getMeta();
    }
    return { status: 'ready', value: stale, hit: true, stale: true };
  }

  const diskFallback = options.diskFallback;
  if (diskFallback?.endpoint) {
    const diskValue = readHubDiskSnapshot(diskFallback.endpoint, diskFallback.year);
    if (diskValue != null) {
      // Seed memory so the next request is a hot hit. Cron warm-memory refreshes later.
      hubCache.set(cacheKey, diskValue);
      ready = true;
      warmKeyCount = Math.max(warmKeyCount, 1);
      getMeta();
      if (!stayGreen && !noSync) refreshCacheKey(cacheKey, builderFn, timeoutMs);
      return { status: 'ready', value: diskValue, hit: true, stale: true, diskSnapshot: true };
    }
  }

  // Stay-green / App Review: never start a sync hub build on the request path.
  if (stayGreen) {
    return { status: 'building', hit: false, reason: 'api_stay_green' };
  }

  // Tier B+: GETs never start hub rebuilds (sync or background). Keepalive + fans were
  // stampeding buildHubBundle after every restart and crash-looping Render → 502.
  // Only cron warm-memory / hub-refresh / explicit warmEliteHubCaches refill memory.
  if (noSync) {
    return { status: 'building', hit: false, reason: 'deferred_rebuild' };
  }

  // Legacy sync path (HUB_GET_NO_SYNC_BUILD=false only).
  try {
    const build = inflightBuilds.get(cacheKey) || startInflightBuild(cacheKey, builderFn, timeoutMs);
    const { value, buildMs } = await withTimeout(build, timeoutMs, cacheKey);
    return { status: 'ready', value, hit: false, stale: false, buildMs };
  } catch (err) {
    console.warn('[recruiting-hub-cache] build timeout/miss', cacheKey, err.message);
    scheduleAsyncWarm({ priorityOnly: true });
    return { status: 'building', hit: false, reason: err.message };
  }
}

function refreshCacheKey(cacheKey, builderFn, timeoutMs = BUILD_TIMEOUT_MS) {
  if (warming) return;
  setImmediate(() => {
    startInflightBuild(cacheKey, builderFn, timeoutMs).catch((err) => {
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
  // Keep /ready hubMeta in sync whenever hub routes answer.
  const hubSnap = getMeta();
  if (result.status === 'building') {
    return res.status(200).json(buildingResponse({ endpoint, year, cacheKey }));
  }

  const meta = hubMeta({
    cacheKey,
    hubReady: isReady(),
    cacheHit: result.hit,
    cacheStale: result.stale ?? false,
    warmKeyCount: hubSnap.warmKeyCount,
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

function parseWarmYears(raw, fallback) {
  const years = String(raw || '')
    .split(',')
    .map((y) => parseInt(y.trim(), 10))
    .filter((y) => Number.isFinite(y));
  return years.length ? years : fallback;
}

function scheduleHubBootPipeline() {
  if (bootPipelineScheduled) {
    return getMeta();
  }
  bootPipelineScheduled = true;

  const pipelineGuards = require('./pipeline-guards');
  // Respect ALLOW_HEAVY — raw API_STAY_GREEN=true was blocking elite boot warm forever.
  let stayGreen = false;
  try {
    stayGreen = require('./api-stay-green').isStayGreen();
  } catch {
    stayGreen = process.env.API_STAY_GREEN === 'true';
  }

  // Elite: always keep the background re-warm timer. Hub GET no-sync cannot self-heal.
  scheduleBackgroundRefresh();

  // When GETs cannot rebuild (Tier B default), boot MUST warm or hub stays building forever.
  // Opt out only with HUB_BOOT_FORCE_WARM=false.
  const getNoSync = hubGetNoSyncBuild();
  const forceBootWarm =
    process.env.HUB_BOOT_FORCE_WARM !== 'false' &&
    (process.env.HUB_BOOT_FORCE_WARM === 'true' || getNoSync);
  const skipBootWarm =
    !forceBootWarm &&
    (process.env.HUB_BOOT_SKIP_WARM === 'true' ||
      stayGreen ||
      process.env.NODE_ENV === 'production');

  bootWarmDecision = {
    at: new Date().toISOString(),
    stayGreen,
    apiStayGreenEnv: process.env.API_STAY_GREEN || null,
    allowHeavy: process.env.API_STAY_GREEN_ALLOW_HEAVY === 'true',
    getNoSync,
    forceBootWarm,
    skipBootWarm,
    skipWarmEnv: process.env.HUB_BOOT_SKIP_WARM || null,
  };

  if (skipBootWarm) {
    console.log(
      '[recruiting-hub] boot warm skipped — rely on hub-warm / hub-refresh cron; background refresh every',
      REFRESH_MS,
      'ms',
      bootWarmDecision
    );
    getMeta();
    return;
  }

  // Deferred after listen so /ready stays cheap while priority caches refill.
  const bootDelay = Math.max(
    45000,
    parseInt(process.env.HUB_BOOT_WARM_DELAY_MS || '75000', 10) || 75000
  );
  const immediateWarm = process.env.HUB_BOOT_IMMEDIATE_WARM === 'true';
  const priorityRssLimit = parseInt(process.env.HUB_PRIORITY_WARM_RSS_MB || '520', 10) || 520;
  const bootYears = parseWarmYears(process.env.HUB_BOOT_WARM_YEARS, [2027, 2028]);
  const bootSecondary = process.env.HUB_BOOT_SECONDARY_WARM === 'true';
  // Lab warm defaults ON with force boot (elite Lab first paint).
  const bootLab =
    process.env.HUB_BOOT_WARM_LAB === 'true' ||
    process.env.HUB_BOOT_WARM_FUTURECAST === 'true' ||
    (forceBootWarm && process.env.HUB_BOOT_WARM_LAB !== 'false');

  bootWarmDecision = {
    ...bootWarmDecision,
    bootDelayMs: immediateWarm ? 0 : bootDelay,
    bootYears,
    bootLab,
    bootSecondary,
    scheduled: true,
  };
  getMeta();

  const runPriorityWarm = () => {
    if (pipelineGuards.shouldSkipHeavyJob('hub-boot-priority-warm', priorityRssLimit)) {
      console.warn('[recruiting-hub] boot priority warm skipped — RSS guard');
      return;
    }
    console.log('[recruiting-hub] boot priority-lite warm start', { years: bootYears, lab: bootLab });
    // Lite only on boot — full bundle OOMed Render (502 loop). Bundle follows delayed.
    warmEliteHubCaches({ priorityLite: true, priorityOnly: true, years: bootYears })
      .then(async () => {
        if (bootLab) {
          try {
            const { runHeavyJob } = require('./heavy-job-gate');
            // High-priority only on boot — full Lab warm is cron-owned.
            const { warmFuturecastHighPriorityCaches } = require('../api/futurecast/response-cache.ts');
            const hp = await runHeavyJob('futurecast-hp-warm', () =>
              warmFuturecastHighPriorityCaches(bootYears)
            );
            console.log('[recruiting-hub] boot high-priority warm complete', hp);
          } catch (err) {
            console.warn('[recruiting-hub] boot high-priority warm failed:', err.message);
          }
        }
        return null;
      })
      .catch((err) => {
        console.warn('[recruiting-hub-cache] boot warm failed:', err.message);
      });
  };

  if (immediateWarm) {
    setImmediate(runPriorityWarm);
  } else {
    setTimeout(runPriorityWarm, bootDelay);
  }

  // Bundle after lite has had time to finish — never on the same tick as lite start.
  const bundleDelayFromBoot =
    (immediateWarm ? 0 : bootDelay) +
    Math.max(90000, parseInt(process.env.HUB_BOOT_BUNDLE_DELAY_MS || '120000', 10) || 120000);
  setTimeout(() => {
    if (pipelineGuards.shouldSkipHeavyJob('hub-boot-bundle-warm', priorityRssLimit)) {
      console.warn('[recruiting-hub] boot bundle warm skipped — RSS guard');
      return;
    }
    const bundleYears = bootYears.slice().sort((a, b) => b - a); // 2028 first
    console.log('[recruiting-hub] boot bundle warm start', bundleYears);
    warmEliteHubCaches({ bundleOnly: true, years: bundleYears })
      .then((meta) => console.log('[recruiting-hub] boot bundle warm complete', meta?.warmKeyCount))
      .catch((err) => console.warn('[recruiting-hub] boot bundle warm failed:', err.message));
  }, bundleDelayFromBoot);
  bootWarmDecision = { ...bootWarmDecision, bundleDelayMs: bundleDelayFromBoot, priorityLite: true };

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

  console.log(
    '[recruiting-hub] boot warm',
    immediateWarm ? 'immediate-priority' : `deferred-priority ${bootDelay}ms`,
    'years',
    bootYears.join(','),
    'lab',
    bootLab,
    'secondary',
    bootSecondary,
    '; background every',
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
  writeHubDiskSnapshot,
  persistDurableCacheValue,
  hubGetNoSyncBuild,
};
