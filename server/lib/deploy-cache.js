/**
 * Deploy-time cache invalidation — clears in-memory caches on every API boot.
 */
function safeClear(label, fn) {
  try {
    fn();
    return true;
  } catch (err) {
    console.warn(`[deploy-cache] ${label} clear skipped:`, err.message);
    return false;
  }
}

function invalidateAllOnDeploy() {
  const cleared = [];
  if (safeClear('heat-check', () => require('./heat-check-store').clearHeatCheckCache())) {
    cleared.push('heat-check');
  }
  if (
    safeClear('live-dashboard', () => {
      const mod = require('./live-dashboard-cache');
      if (typeof mod.clearDashboardCache === 'function') mod.clearDashboardCache();
    })
  ) {
    cleared.push('live-dashboard');
  }
  console.log('[deploy-cache] invalidated:', cleared.length ? cleared.join(', ') : 'none');
  return { cleared, at: new Date().toISOString() };
}

module.exports = { invalidateAllOnDeploy };
