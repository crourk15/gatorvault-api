/**
 * Daily refresh for Recruiting Command Center hub caches.
 */
const REFRESH_INTERVAL_MS = parseInt(
  process.env.HUB_REFRESH_INTERVAL_MS || String(6 * 60 * 60 * 1000),
  10
);

async function refreshRecruitingHubCaches(options = {}) {
  const { clearHubCache, warmEliteHubCaches } = require('./recruiting-hub-cache');
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

  let warmMeta = null;
  if (options.warmAfter !== false) {
    warmMeta = await warmEliteHubCaches(options.warmOptions);
  }

  return {
    refreshedAt: new Date().toISOString(),
    restoredVerifiedCommits,
    enrichedPlayerCount: dataset.players.size,
    battleBoardCount: battleBoard.length,
    movementFeedCount: movementFeed.length,
    footprintStateCount: footprint.states?.length ?? 0,
    staffAssignedCount: staffSync.staffAssignedCount ?? 0,
    geoNormalizedCount,
    hubCache: warmMeta,
  };
}

function scheduleRecruitingHubRefresh() {
  const tick = () => {
    refreshRecruitingHubCaches({ geoBackfill: process.env.HUB_REFRESH_GEO_BACKFILL === 'true' })
      .then((result) => {
        console.log(
          '[recruiting-hub] scheduled refresh:',
          result.enrichedPlayerCount,
          'players,',
          result.battleBoardCount,
          'battles,',
          result.movementFeedCount,
          'intel,',
          result.footprintStateCount,
          'states,',
          result.hubCache?.warmKeyCount ?? 0,
          'cache keys'
        );
      })
      .catch((err) => {
        console.warn('[recruiting-hub] scheduled refresh failed:', err.message);
      });
  };

  setInterval(tick, REFRESH_INTERVAL_MS);
  console.log(
    '[recruiting-hub] refresh scheduled every',
    Math.round(REFRESH_INTERVAL_MS / 3600000),
    'h'
  );
}

module.exports = {
  refreshRecruitingHubCaches,
  scheduleRecruitingHubRefresh,
};
