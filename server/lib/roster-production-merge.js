/**
 * Merge official-box / CFBD productionStats without wiping the other source.
 * Season totals add when a new game is applied; existing week+category rows stay put.
 */
'use strict';

function seasonKey(line) {
  return `${line.season}|${line.category}`;
}

function gameKey(line) {
  return `${line.season}|${line.week}|${line.category || ''}`;
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function addStatMaps(base, add) {
  const out = { ...(base || {}) };
  for (const [key, raw] of Object.entries(add || {})) {
    if (key === 'avg') continue;
    const n = toNum(raw);
    if (n == null) continue;
    if (key === 'lng') {
      const prev = toNum(out.lng);
      out.lng = prev == null ? n : Math.max(prev, n);
      continue;
    }
    out[key] = (toNum(out[key]) || 0) + n;
  }
  const den = out.rec ?? out.car ?? out.att;
  if (den && toNum(out.yds) != null) {
    out.avg = Math.round((out.yds / den) * 10) / 10;
  }
  return out;
}

function attachGameMeta(line, game) {
  return {
    season: game.season,
    week: game.week,
    date: game.date || null,
    opponent: game.opponent,
    homeAway: game.homeAway || null,
    category: line.category,
    stats: line.stats,
  };
}

function attachSeasonMeta(line, game) {
  return {
    season: game.season,
    team: 'Florida',
    category: line.category,
    stats: line.stats,
  };
}

function preserveTrustedSource(existing) {
  if (existing?.source === 'cfbd' || existing?.source === 'official') return existing.source;
  return 'official';
}

const RECENT_GAMES_LIMIT = 64;

function statsFingerprint(stats) {
  return Object.keys(stats || {})
    .filter((key) => key !== 'avg')
    .sort()
    .map((key) => `${key}:${stats[key]}`)
    .join('|');
}

function recomputeSeasonFromGames(nextSeasons, nextGames, season, category) {
  const games = nextGames.filter((g) => g.season === season && g.category === category);
  const sk = seasonKey({ season, category });
  const idx = nextSeasons.findIndex((s) => seasonKey(s) === sk);
  if (!games.length) {
    if (idx >= 0) nextSeasons.splice(idx, 1);
    return;
  }
  let stats = {};
  for (const game of games) stats = addStatMaps(stats, game.stats);
  const row = { season, team: 'Florida', category, stats };
  if (idx >= 0) nextSeasons[idx] = { ...nextSeasons[idx], ...row };
  else nextSeasons.unshift(row);
}

function stampBlob(existing, nextSeasons, nextGames, syncedAt) {
  return {
    source: preserveTrustedSource(existing),
    syncedAt,
    cfbdPlayerId:
      existing?.cfbdPlayerId != null && Number.isFinite(Number(existing.cfbdPlayerId))
        ? Number(existing.cfbdPlayerId)
        : null,
    matchConfidence:
      existing?.matchConfidence === 'exact' || existing?.matchConfidence === 'high'
        ? existing.matchConfidence
        : null,
    seasons: nextSeasons,
    recentGames: nextGames.slice(0, RECENT_GAMES_LIMIT),
  };
}

/**
 * Apply one official game's category lines onto a player blob.
 * Upserts season|week|category and recomputes that season total from game rows.
 */
function applyOfficialGameLines(existing, game, lines, syncedAt) {
  const incoming = (lines || []).filter((l) => l && l.category && l.stats);
  if (!incoming.length) return existing || null;

  const nextGames = Array.isArray(existing?.recentGames) ? existing.recentGames.slice() : [];
  const nextSeasons = Array.isArray(existing?.seasons) ? existing.seasons.slice() : [];
  let changed = false;

  for (const line of incoming) {
    const gameRow = attachGameMeta(line, game);
    const gk = gameKey(gameRow);
    const existingIdx = nextGames.findIndex((g) => gameKey(g) === gk);
    if (existingIdx >= 0) {
      if (statsFingerprint(nextGames[existingIdx].stats) === statsFingerprint(line.stats)) continue;
      nextGames[existingIdx] = gameRow;
      changed = true;
    } else {
      nextGames.unshift(gameRow);
      changed = true;
    }
    recomputeSeasonFromGames(nextSeasons, nextGames, game.season, line.category);
  }

  if (!changed && existing) {
    return { ...existing, syncedAt: existing.syncedAt || syncedAt };
  }

  return stampBlob(existing, nextSeasons, nextGames, syncedAt);
}

function stripSeasonProduction(existing, season) {
  if (!existing) return null;
  return {
    ...existing,
    seasons: (existing.seasons || []).filter((s) => s.season !== season),
    recentGames: (existing.recentGames || []).filter((g) => g.season !== season),
  };
}

function rebuildOfficialSeason(existing, season, packets, syncedAt) {
  let next = stripSeasonProduction(existing, season);
  const ordered = (packets || []).slice().sort((a, b) => (a.game?.week || 0) - (b.game?.week || 0));
  for (const packet of ordered) {
    next = applyOfficialGameLines(next, packet.game, packet.lines, syncedAt);
  }
  return next;
}

function productionFingerprint(blob) {
  const games = (blob?.recentGames || [])
    .map((g) => `${gameKey(g)}|${statsFingerprint(g.stats)}`)
    .sort();
  const seasons = (blob?.seasons || [])
    .map((s) => `${seasonKey(s)}|${statsFingerprint(s.stats)}`)
    .sort();
  return `${games.join(';')}#${seasons.join(';')}`;
}

/**
 * Keep seasons/games the incoming CFBD blob does not have yet
 * (official Week 1 on a cfbd career, etc.).
 */
function mergeExistingForward(existing, incoming) {
  if (!existing || !incoming) return incoming || existing || null;
  let next = incoming;
  for (const game of existing.recentGames || []) {
    if (!game || !game.category || !game.stats) continue;
    next = applyOfficialGameLines(
      next,
      {
        season: game.season,
        week: game.week,
        date: game.date,
        opponent: game.opponent,
        homeAway: game.homeAway,
      },
      [{ category: game.category, stats: game.stats }],
      incoming.syncedAt || existing.syncedAt
    );
  }
  const nextSeasonKeys = new Set((next.seasons || []).map(seasonKey));
  const extraSeasons = (existing.seasons || []).filter((s) => !nextSeasonKeys.has(seasonKey(s)));
  if (!extraSeasons.length) return next;
  return {
    ...next,
    seasons: [...extraSeasons, ...(next.seasons || [])],
  };
}

module.exports = {
  seasonKey,
  gameKey,
  addStatMaps,
  attachGameMeta,
  attachSeasonMeta,
  applyOfficialGameLines,
  rebuildOfficialSeason,
  stripSeasonProduction,
  productionFingerprint,
  RECENT_GAMES_LIMIT,
  mergeExistingForward,
  preserveTrustedSource,
};
