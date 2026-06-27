/**
 * Public UI data freshness — surfaces cache + ingest ages for recruiting/live modules.
 */
const { getMeta, hubCache, classSnapshotCacheKey } = require('./recruiting-hub-cache');

const DEFAULT_PRIMARY_YEAR = parseInt(process.env.ACTIVE_RECRUITING_CLASS_YEAR || '2027', 10);

const DEFAULT_YEARS = String(process.env.HUB_WARM_YEARS || '2026,2027,2028,2029')
  .split(',')
  .map((y) => parseInt(y.trim(), 10))
  .filter((y) => Number.isFinite(y));

function ageMs(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Date.now() - t);
}

function cacheStatus(key) {
  const hit = hubCache.get(key);
  if (hit != null) return 'ready';
  const stale = hubCache.getStale(key);
  if (stale != null) return 'stale';
  return 'miss';
}

function buildUiHealthReport(options = {}) {
  const years = options.years || DEFAULT_YEARS;
  const primaryYear = options.year ?? (Number.isFinite(DEFAULT_PRIMARY_YEAR) ? DEFAULT_PRIMARY_YEAR : 2027);

  let intelUpdatedAt = null;
  try {
    const intelStore = require('./recruiting-intel-store');
    const doc = intelStore.loadIntelDoc?.();
    intelUpdatedAt = doc?.updatedAt ?? null;
  } catch {
    intelUpdatedAt = null;
  }

  let beatFetchedAt = null;
  try {
    const liveStore = require('./live-store');
    beatFetchedAt = liveStore.loadBeatCache?.()?.fetchedAt ?? null;
  } catch {
    beatFetchedAt = null;
  }

  let podcastFetchedAt = null;
  let podcastShowCount = 0;
  try {
    const liveStore = require('./live-store');
    const podcasts = liveStore.loadPodcastCache();
    podcastFetchedAt = podcasts.fetchedAt ?? null;
    podcastShowCount = (podcasts.shows || []).length;
  } catch {
    podcastFetchedAt = null;
  }

  const hub = getMeta();
  const cacheKeys = {
    movement: 'recruiting:movement',
    highPriorityIntel: 'hub:intel:high-priority',
    beatIntel: 'hub:intel:beat',
    classSnapshot: classSnapshotCacheKey(primaryYear),
    battles: `recruiting:battles:${primaryYear}`,
    battlesAndMovement: `recruiting:battles-and-movement:${primaryYear}`,
    heatIndex: `recruiting:heat-index:${primaryYear}`,
    positions: `recruiting:positions:${primaryYear}`,
    footprint: `recruiting:footprint:${primaryYear}`,
  };

  const caches = Object.fromEntries(
    Object.entries(cacheKeys).map(([name, key]) => [name, { key, status: cacheStatus(key) }])
  );

  const intelAgeMs = ageMs(intelUpdatedAt);
  const podcastAgeMs = ageMs(podcastFetchedAt);
  const beatAgeMs = ageMs(beatFetchedAt);
  const hubWarmAgeMs = ageMs(hub.lastWarmAt);

  const staleThresholdMs = parseInt(process.env.UI_HEALTH_STALE_MS || String(30 * 60 * 1000), 10);
  const issues = [];
  if (!hub.ready && hub.status !== 'ready') issues.push('hub_cache_not_ready');
  if (intelAgeMs != null && intelAgeMs > staleThresholdMs * 4) issues.push('intel_stale');
  if (podcastAgeMs != null && podcastAgeMs > staleThresholdMs * 2) issues.push('podcasts_stale');
  // Per-key cache misses are informational only — Render may serve health from a cold worker.

  return {
    ok: issues.length === 0,
    checkedAt: new Date().toISOString(),
    primaryYear,
    hub: {
      ready: hub.ready,
      status: hub.status,
      warming: hub.warming,
      lastWarmAt: hub.lastWarmAt,
      warmAgeMs: hubWarmAgeMs,
      warmKeyCount: hub.warmKeyCount,
      lastWarmError: hub.lastWarmError,
    },
    intel: {
      updatedAt: intelUpdatedAt,
      ageMs: intelAgeMs,
    },
    beat: {
      fetchedAt: beatFetchedAt,
      ageMs: beatAgeMs,
      cacheStatus: caches.beatIntel.status,
    },
    podcasts: {
      fetchedAt: podcastFetchedAt,
      ageMs: podcastAgeMs,
      showCount: podcastShowCount,
    },
    caches,
    issues,
    staleThresholdMs,
  };
}

module.exports = { buildUiHealthReport };
