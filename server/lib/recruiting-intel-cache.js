/**
 * Invalidate recruiting + FutureCast API caches after intel ingest.
 */
const { clearHeatCheckCache } = require('./heat-check-store');

function clearHubCacheSafe() {
  try {
    const { clearHubCache } = require('./recruiting-hub-routes');
    if (typeof clearHubCache === 'function') clearHubCache();
  } catch (err) {
    console.warn('[recruiting-intel-cache] hub cache clear failed:', err.message);
  }
}

function invalidateUiCacheKeys() {
  try {
    const {
      removeHubCacheKeys,
      scheduleAsyncWarm,
      classSnapshotCacheKey,
      eliteClassOverviewCacheKey,
      eliteClassOverviewAllCacheKey,
      eliteBundleCacheKey,
    } = require('./recruiting-hub-cache');
    const years = String(process.env.HUB_WARM_YEARS || '2026,2027,2028,2029')
      .split(',')
      .map((y) => parseInt(y.trim(), 10))
      .filter((y) => Number.isFinite(y));
    const keys = ['recruiting:movement', 'hub:intel:high-priority', 'hub:intel:beat', eliteClassOverviewAllCacheKey()];
    for (const year of years) {
      keys.push(
        classSnapshotCacheKey(year),
        eliteClassOverviewCacheKey(year),
        eliteBundleCacheKey(year),
        `recruiting:battles:${year}`,
        `recruiting:battles-and-movement:${year}`,
        `recruiting:heat-index:${year}`,
        `recruiting:positions:${year}`,
        `recruiting:footprint:${year}`
      );
    }
    const removed = removeHubCacheKeys(keys);
    if (removed > 0) {
      console.log('[recruiting-intel-cache] invalidated UI cache keys:', removed);
    }
    if (typeof scheduleAsyncWarm === 'function') scheduleAsyncWarm();
  } catch (err) {
    console.warn('[recruiting-intel-cache] UI cache key invalidation failed:', err.message);
    clearHubCacheSafe();
  }
}

function clearPodcastCacheSafe() {
  try {
    const liveStore = require('./live-store');
    if (typeof liveStore.clearPodcastCache === 'function') liveStore.clearPodcastCache();
  } catch (err) {
    console.warn('[recruiting-intel-cache] podcast cache clear failed:', err.message);
  }
}

function clearFuturecastCacheSafe() {
  void import('../api/futurecast/response-cache.ts')
    .then((mod) => mod.clearFuturecastCache?.())
    .catch((err) => {
      console.warn('[recruiting-intel-cache] futurecast cache clear failed:', err.message);
    });
}

function invalidateRecruitingIntelCaches() {
  invalidateUiCacheKeys();
  clearPodcastCacheSafe();
  clearHeatCheckCache();
  clearFuturecastCacheSafe();
}

module.exports = {
  invalidateRecruitingIntelCaches,
  invalidateUiCacheKeys,
  clearHubCacheSafe,
  clearFuturecastCacheSafe,
  clearPodcastCacheSafe,
};
