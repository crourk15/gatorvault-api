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

function clearFuturecastCacheSafe() {
  void import('../api/futurecast/response-cache.ts')
    .then((mod) => mod.clearFuturecastCache?.())
    .catch((err) => {
      console.warn('[recruiting-intel-cache] futurecast cache clear failed:', err.message);
    });
}

function invalidateRecruitingIntelCaches() {
  clearHubCacheSafe();
  clearHeatCheckCache();
  clearFuturecastCacheSafe();
}

module.exports = { invalidateRecruitingIntelCaches, clearHubCacheSafe, clearFuturecastCacheSafe };
