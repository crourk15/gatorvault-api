/**
 * Daily refresh for Recruiting Command Center hub caches.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

async function refreshRecruitingHubCaches(options = {}) {
  const { clearHubCache } = require('./recruiting-hub-routes');
  const { syncStaffAssignments } = require('./recruiting-staff-assignments');
  const { restoreVerifiedHubCommitsInStore } = require('./recruiting-verified-commits');
  const {
    loadHubDataset,
    buildBattleBoardRows,
    buildMovementFeedItems,
    buildFootprintPayload,
    buildHeatIndexRows,
    buildBattlesListRows,
  } = require('./recruiting-hub-data');

  const restoredVerifiedCommits = await restoreVerifiedHubCommitsInStore();
  const staffSync = await syncStaffAssignments();

  let geoNormalizedCount = 0;
  if (options.geoBackfill) {
    const store = require('./recruiting-store');
    const { normalizePlayerGeo } = require('./recruiting-geo-normalize');
    const all = await store.getAllPlayers();
    for (const player of all) {
      if (!player.slug) continue;
      const patch = normalizePlayerGeo(player);
      const changed =
        (patch.hometownState && patch.hometownState !== player.hometownState) ||
        (patch.pinLat != null && patch.pinLat !== player.pinLat);
      if (changed) {
        await store.upsertPlayer({ ...player, ...patch });
        geoNormalizedCount += 1;
      }
    }
  }

  clearHubCache();

  const dataset = await loadHubDataset();
  const players = [...dataset.players.values()];
  const targets = players.filter((p) => !p.isCommit);

  const [battleBoard, movementFeed, footprint, heatIndex, battles] = await Promise.all([
    Promise.resolve(buildBattleBoardRows(targets)),
    Promise.resolve(
      buildMovementFeedItems(players, dataset.intelRows, {
        visitLogs: dataset.visitLogs,
        offerLogs: dataset.offerLogs,
      })
    ),
    Promise.resolve(
      buildFootprintPayload(players, dataset.intelRows, {
        visitLogs: dataset.visitLogs,
        offerLogs: dataset.offerLogs,
      })
    ),
    Promise.resolve(buildHeatIndexRows(targets)),
    Promise.resolve(buildBattlesListRows(targets)),
  ]);

  void heatIndex;
  void battles;

  return {
    refreshedAt: new Date().toISOString(),
    restoredVerifiedCommits,
    enrichedPlayerCount: dataset.players.size,
    battleBoardCount: battleBoard.length,
    movementFeedCount: movementFeed.length,
    footprintStateCount: footprint.states?.length ?? 0,
    staffAssignedCount: staffSync.staffAssignedCount ?? 0,
    geoNormalizedCount,
  };
}

function scheduleRecruitingHubRefresh() {
  const tick = () => {
    refreshRecruitingHubCaches()
      .then((result) => {
        console.log(
          '[recruiting-hub] daily refresh:',
          result.enrichedPlayerCount,
          'players,',
          result.battleBoardCount,
          'battles,',
          result.movementFeedCount,
          'intel,',
          result.footprintStateCount,
          'states'
        );
      })
      .catch((err) => {
        console.warn('[recruiting-hub] daily refresh failed:', err.message);
      });
  };

  setInterval(tick, DAY_MS);
  console.log('[recruiting-hub] daily refresh scheduled (every 24h)');
}

module.exports = {
  refreshRecruitingHubCaches,
  scheduleRecruitingHubRefresh,
};
