/**
 * Nightly Tier A player intelligence refresh — golden four On3 sync + gap repair.
 */
const REFRESH_INTERVAL_MS = parseInt(
  process.env.PLAYER_INTEL_REFRESH_INTERVAL_MS || String(24 * 60 * 60 * 1000),
  10
);

async function refreshTierAIntelligence(options = {}) {
  const { refreshTierAPlayers } = require('./player-intelligence/orchestrator');
  return refreshTierAPlayers({
    limit: Number(options.limit || 0) || undefined,
    verbose: options.verbose === true
  });
}

function schedulePlayerIntelligenceRefresh() {
  if (process.env.PLAYER_INTEL_REFRESH_ENABLED === 'false') return;

  const tick = () => {
    refreshTierAIntelligence({ verbose: false })
      .then((result) => {
        console.log(
          '[player-intelligence] scheduled refresh:',
          result.processed,
          'players,',
          result.rankingComplete,
          'ranked,',
          'goldenFour complete:',
          result.goldenFour?.complete === true
        );
      })
      .catch((err) => {
        console.warn('[player-intelligence] scheduled refresh failed:', err.message);
      });
  };

  setInterval(tick, REFRESH_INTERVAL_MS);
  console.log(
    '[player-intelligence] refresh scheduled every',
    Math.round(REFRESH_INTERVAL_MS / 3600000),
    'h'
  );
}

module.exports = {
  refreshTierAIntelligence,
  schedulePlayerIntelligenceRefresh,
  REFRESH_INTERVAL_MS
};
