/**
 * Daily refresh for Recruiting Command Center hub caches.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

async function refreshRecruitingHubCaches() {
  const { clearHubCache } = require('./recruiting-hub-routes');
  const {
    buildHubBattleBoard,
    buildHubMovementFeed,
    buildHubFootprint,
  } = require('./recruiting-hub-intel-store');

  clearHubCache();

  const [battleBoard, movementFeed, footprint] = await Promise.all([
    buildHubBattleBoard(),
    buildHubMovementFeed(),
    buildHubFootprint(),
  ]);

  return {
    refreshedAt: new Date().toISOString(),
    battleBoardCount: battleBoard.length,
    movementFeedCount: movementFeed.length,
    footprintStateCount: footprint.states?.length ?? 0,
  };
}

function scheduleRecruitingHubRefresh() {
  const tick = () => {
    refreshRecruitingHubCaches()
      .then((result) => {
        console.log(
          '[recruiting-hub] daily refresh:',
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
