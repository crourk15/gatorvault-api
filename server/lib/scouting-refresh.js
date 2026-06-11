/**
 * Broadcast War Room / scouting UI refresh signals (client listens via localStorage).
 */
let scoutingRefreshSignal = 0;

function bumpScoutingRefreshSignal(meta = {}) {
  scoutingRefreshSignal = Date.now();
  return scoutingRefreshSignal;
}

function getScoutingRefreshSignal() {
  return scoutingRefreshSignal;
}

function buildRefreshPayload(meta = {}) {
  const at = Date.now();
  return {
    at,
    iso: new Date(at).toISOString(),
    localStorageKeys: [
      'gv_scouting_updated',
      'gv_war_room_updated',
      'gv_roster_updated',
      'gv_recruiting_updated',
      'gv_vault_grade_updated'
    ],
    meta
  };
}

function invalidateServerCaches() {
  try {
    require('./heat-check-store').clearHeatCheckCache();
  } catch {
    /* optional */
  }
  try {
    const ldc = require('./live-dashboard-cache');
    ldc.warmDashboardCache();
    ldc.bumpMobileRefreshSignal();
  } catch {
    /* optional */
  }
}

function triggerScoutingUiRefresh(meta = {}) {
  invalidateServerCaches();
  bumpScoutingRefreshSignal(meta);
  return buildRefreshPayload(meta);
}

module.exports = {
  buildRefreshPayload,
  invalidateServerCaches,
  triggerScoutingUiRefresh,
  bumpScoutingRefreshSignal,
  getScoutingRefreshSignal
};
