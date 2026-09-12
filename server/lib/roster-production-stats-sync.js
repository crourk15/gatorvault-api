/**
 * Sync confirmed CFBD production stats onto UF roster players.
 * Missing API key or no match → productionStats null (no filler).
 */

const rosterStore = require('./roster-store');
const {
  hasCfbdApiKey,
  seasonsToFetch,
  fetchFloridaPlayerSeasonStats,
  fetchFloridaGamePlayerStats,
} = require('./cfbd-client');
const { indexCfbdPlayers, matchRosterToCfbd, normalizePersonName } = require('./roster-production-stats-match');
const {
  aggregateSeasonStats,
  aggregateGameStats,
  buildProductionStats,
} = require('./roster-production-stats-transform');

function isOfficialProductionStats(raw) {
  if (!raw || raw.source !== 'official') return false;
  const seasons = Array.isArray(raw.seasons) ? raw.seasons : [];
  const games = Array.isArray(raw.recentGames) ? raw.recentGames : [];
  return seasons.length > 0 || games.length > 0;
}

/**
 * Keep official-box seasons/games CFBD has not ingested yet (e.g. Week 1
 * stamped from the UF box before the next CFBD pull).
 */
function mergeOfficialForward(existing, cfbd) {
  if (!isOfficialProductionStats(existing) || !cfbd) return cfbd;
  const cfbdSeasonKeys = new Set(
    (cfbd.seasons || []).map((s) => `${s.season}|${s.category}`)
  );
  const extraSeasons = (existing.seasons || []).filter(
    (s) => !cfbdSeasonKeys.has(`${s.season}|${s.category}`)
  );
  const cfbdGameKeys = new Set(
    (cfbd.recentGames || []).map((g) => `${g.season}|${g.week}|${g.opponent}|${g.category || ''}`)
  );
  const extraGames = (existing.recentGames || []).filter(
    (g) => !cfbdGameKeys.has(`${g.season}|${g.week}|${g.opponent}|${g.category || ''}`)
  );
  if (!extraSeasons.length && !extraGames.length) return cfbd;
  return {
    ...cfbd,
    seasons: [...extraSeasons, ...(cfbd.seasons || [])],
    recentGames: [...extraGames, ...(cfbd.recentGames || [])].slice(0, 8),
  };
}

async function syncRosterProductionStats(opts = {}) {
  if (!hasCfbdApiKey()) {
    return {
      ok: true,
      skipped: true,
      reason: 'CFBD_API_KEY missing',
      matched: 0,
      cleared: 0,
      seasons: [],
    };
  }

  const lookback = Number(opts.lookback || process.env.ROSTER_STATS_LOOKBACK_SEASONS || 4);
  const seasons = seasonsToFetch(new Date(), lookback);
  const syncedAt = new Date().toISOString();

  const allSeasonRows = [];
  /** @type {Map<number, Map<string, any[]>>} */
  const gameAggBySeason = new Map();
  const errors = [];

  for (const year of seasons) {
    try {
      const rows = await fetchFloridaPlayerSeasonStats(year);
      if (Array.isArray(rows)) allSeasonRows.push(...rows);
    } catch (err) {
      errors.push(`season ${year}: ${err.message}`);
    }
    try {
      const games = await fetchFloridaGamePlayerStats(year);
      if (Array.isArray(games)) {
        gameAggBySeason.set(year, aggregateGameStats(games, year));
      }
    } catch (err) {
      errors.push(`games ${year}: ${err.message}`);
    }
  }

  const seasonAgg = aggregateSeasonStats(allSeasonRows);
  const cfbdIndex = indexCfbdPlayers(allSeasonRows);

  // Also index from seasonAgg names for players only in game boxes
  for (const [, agg] of seasonAgg) {
    const key = normalizePersonName(agg.name);
    if (!key) continue;
    if (!cfbdIndex.has(key)) cfbdIndex.set(key, []);
    const list = cfbdIndex.get(key);
    if (!list.some((x) => x.playerId === agg.playerId)) {
      list.push({ playerId: agg.playerId, name: agg.name, position: agg.position });
    }
  }

  const players = rosterStore.loadPlayersRaw
    ? rosterStore.loadPlayersRaw()
    : require('fs').existsSync(rosterStore.PLAYERS_PATH)
      ? JSON.parse(require('fs').readFileSync(rosterStore.PLAYERS_PATH, 'utf8'))
      : [];

  const updates = {};
  let matched = 0;
  let cleared = 0;
  let unmatched = 0;

  for (const raw of players) {
    const slug = raw.slug || require('./slug').slugify(raw.name);
    const rosterPlayer = {
      ...raw,
      slug,
      pos: raw.pos || raw.position,
    };
    const match = matchRosterToCfbd(rosterPlayer, cfbdIndex);
    if (!match) {
      if (raw.productionStats && !isOfficialProductionStats(raw.productionStats)) {
        updates[slug] = null;
        cleared += 1;
      }
      unmatched += 1;
      continue;
    }

    const productionStats = buildProductionStats({
      match,
      seasonAgg,
      gameAggBySeason,
      rosterPos: rosterPlayer.pos,
      syncedAt,
    });

    if (!productionStats) {
      if (raw.productionStats && !isOfficialProductionStats(raw.productionStats)) {
        updates[slug] = null;
        cleared += 1;
      }
      unmatched += 1;
      continue;
    }

    updates[slug] = mergeOfficialForward(raw.productionStats, productionStats);
    matched += 1;
  }

  const writeResult = rosterStore.applyProductionStatsUpdates
    ? rosterStore.applyProductionStatsUpdates(updates)
    : { changed: 0 };

  return {
    ok: true,
    skipped: false,
    syncedAt,
    seasons,
    matched,
    cleared,
    unmatched,
    changed: writeResult.changed || 0,
    errors: errors.length ? errors : undefined,
  };
}

module.exports = {
  syncRosterProductionStats,
  isOfficialProductionStats,
  mergeOfficialForward,
};