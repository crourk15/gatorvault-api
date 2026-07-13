/**
 * Turn raw CFBD season + game payloads into productionStats shape.
 */

const CATEGORY_ALIASES = {
  passing: 'passing',
  rushing: 'rushing',
  receiving: 'receiving',
  defensive: 'defense',
  defense: 'defense',
  kicking: 'kicking',
  punting: 'punting',
  kr: 'returning',
  pr: 'returning',
  returning: 'returning',
  kickReturn: 'returning',
  puntReturn: 'returning',
};

const FLAT_STAT_KEYS = {
  passing: [
    ['completions', 'cmp'],
    ['passingCompletions', 'cmp'],
    ['attempts', 'att'],
    ['passingAttempts', 'att'],
    ['passingYards', 'yds'],
    ['yards', 'yds'],
    ['passingTDs', 'td'],
    ['passingTouchdowns', 'td'],
    ['touchdowns', 'td'],
    ['interceptions', 'int'],
    ['passingInterceptions', 'int'],
  ],
  rushing: [
    ['rushingAttempts', 'car'],
    ['carries', 'car'],
    ['attempts', 'car'],
    ['rushingYards', 'yds'],
    ['yards', 'yds'],
    ['rushingTDs', 'td'],
    ['rushingTouchdowns', 'td'],
    ['touchdowns', 'td'],
    ['longRushing', 'lng'],
    ['longest', 'lng'],
  ],
  receiving: [
    ['receptions', 'rec'],
    ['receivingYards', 'yds'],
    ['yards', 'yds'],
    ['receivingTDs', 'td'],
    ['receivingTouchdowns', 'td'],
    ['touchdowns', 'td'],
    ['longReceiving', 'lng'],
    ['longest', 'lng'],
    ['targets', 'tgt'],
  ],
  defense: [
    ['tackles', 'tot'],
    ['totalTackles', 'tot'],
    ['soloTackles', 'solo'],
    ['tacklesForLoss', 'tfl'],
    ['sacks', 'sack'],
    ['interceptions', 'int'],
    ['passesDefended', 'pd'],
    ['forcedFumbles', 'ff'],
  ],
  kicking: [
    ['fgMade', 'fgm'],
    ['fgAttempts', 'fga'],
    ['xpMade', 'xpm'],
    ['xpAttempts', 'xpa'],
    ['points', 'pts'],
  ],
  punting: [
    ['punts', 'punts'],
    ['puntYards', 'yds'],
    ['puntAverage', 'avg'],
    ['longPunt', 'lng'],
  ],
  returning: [
    ['kickReturns', 'kr'],
    ['kickReturnYards', 'krYds'],
    ['kickReturnTDs', 'krTd'],
    ['puntReturns', 'pr'],
    ['puntReturnYards', 'prYds'],
    ['puntReturnTDs', 'prTd'],
  ],
};

const STAT_TYPE_MAP = {
  YDS: 'yds',
  YARDS: 'yds',
  TD: 'td',
  TDS: 'td',
  ATT: 'att',
  CAR: 'car',
  REC: 'rec',
  CMP: 'cmp',
  COMPLETIONS: 'cmp',
  INCOMPLETIONS: 'inc',
  INT: 'int',
  INTERCEPTIONS: 'int',
  LNG: 'lng',
  LONG: 'lng',
  AVG: 'avg',
  TOT: 'tot',
  SOLO: 'solo',
  SACK: 'sack',
  SACKS: 'sack',
  TFL: 'tfl',
  PD: 'pd',
  FF: 'ff',
  FGM: 'fgm',
  FGA: 'fga',
  XPM: 'xpm',
  XPA: 'xpa',
  PTS: 'pts',
  NO: 'rec',
};

function normalizeCategory(raw) {
  const key = String(raw || '')
    .trim()
    .replace(/[\s_-]+/g, '')
    .toLowerCase();
  if (!key) return null;
  if (CATEGORY_ALIASES[key]) return CATEGORY_ALIASES[key];
  if (key.includes('pass')) return 'passing';
  if (key.includes('rush')) return 'rushing';
  if (key.includes('receiv')) return 'receiving';
  if (key.includes('defen') || key.includes('tackle')) return 'defense';
  if (key.includes('kick') && !key.includes('return')) return 'kicking';
  if (key.includes('punt') && !key.includes('return')) return 'punting';
  if (key.includes('return')) return 'returning';
  return null;
}

function toNum(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function applyFlatStats(category, row, into) {
  const pairs = FLAT_STAT_KEYS[category];
  if (!pairs) return;
  for (const [src, dest] of pairs) {
    if (Object.prototype.hasOwnProperty.call(row, src)) {
      const n = toNum(row[src]);
      if (n != null) into[dest] = n;
    }
  }
}

function applyStatType(row, into) {
  const type = String(row.statType || row.type || '').toUpperCase();
  const dest = STAT_TYPE_MAP[type];
  const n = toNum(row.stat ?? row.value);
  if (dest && n != null) into[dest] = n;
}

function playerKeyFromSeasonRow(row) {
  if (row.playerId != null && Number.isFinite(Number(row.playerId))) {
    return `id:${Number(row.playerId)}`;
  }
  const name = String(row.player || row.name || '').trim().toLowerCase();
  return name ? `name:${name}` : null;
}

/**
 * Aggregate CFBD /stats/player/season rows into seasons[] entries per player key.
 * @returns {Map<string, { playerId: number|null, name: string, position: string|null, seasons: object[] }>}
 */
function aggregateSeasonStats(rows) {
  /** @type {Map<string, any>} */
  const byPlayer = new Map();

  for (const row of rows || []) {
    const pkey = playerKeyFromSeasonRow(row);
    if (!pkey) continue;
    const category = normalizeCategory(row.category);
    if (!category) continue;

    if (!byPlayer.has(pkey)) {
      byPlayer.set(pkey, {
        playerId: row.playerId != null ? Number(row.playerId) : null,
        name: String(row.player || row.name || '').trim(),
        position: row.position || row.pos || null,
        seasonMap: new Map(),
      });
    }
    const bucket = byPlayer.get(pkey);
    if (row.playerId != null && Number.isFinite(Number(row.playerId))) {
      bucket.playerId = Number(row.playerId);
    }
    if (row.position || row.pos) bucket.position = row.position || row.pos;

    const season = Number(row.season || row.year);
    if (!Number.isFinite(season)) continue;
    const seasonKey = `${season}|${category}`;
    if (!bucket.seasonMap.has(seasonKey)) {
      bucket.seasonMap.set(seasonKey, {
        season,
        team: String(row.team || 'Florida'),
        category,
        stats: {},
      });
    }
    const entry = bucket.seasonMap.get(seasonKey);
    applyFlatStats(category, row, entry.stats);
    applyStatType(row, entry.stats);

    // AVG if missing and we have yds + volume
    if (entry.stats.avg == null && entry.stats.yds != null) {
      const den = entry.stats.rec ?? entry.stats.car ?? entry.stats.att;
      if (den && den > 0) entry.stats.avg = Math.round((entry.stats.yds / den) * 10) / 10;
    }
  }

  const out = new Map();
  for (const [pkey, bucket] of byPlayer) {
    const seasons = Array.from(bucket.seasonMap.values())
      .filter((s) => Object.keys(s.stats).length > 0)
      .sort((a, b) => b.season - a.season || a.category.localeCompare(b.category));
    if (!seasons.length) continue;
    out.set(pkey, {
      playerId: bucket.playerId,
      name: bucket.name,
      position: bucket.position,
      seasons,
    });
  }
  return out;
}

/**
 * Flatten /games/players nested box scores into recentGames per player key.
 */
function aggregateGameStats(gamePayloads, seasonYear) {
  /** @type {Map<string, object[]>} */
  const byPlayer = new Map();

  for (const game of gamePayloads || []) {
    const week = game.week != null ? Number(game.week) : null;
    const date = game.startDate || game.date || null;
    const teams = game.teams || [];
    for (const team of teams) {
      const school = String(team.school || team.team || '');
      if (school.toLowerCase() !== 'florida') continue;
      const opponent =
        String(
          teams.find((t) => String(t.school || t.team || '').toLowerCase() !== 'florida')?.school ||
            team.opponent ||
            'Opponent'
        ) || 'Opponent';
      let homeAway = null;
      if (team.homeAway) homeAway = String(team.homeAway).toLowerCase();
      else if (game.homeTeam && String(game.homeTeam).toLowerCase() === 'florida') homeAway = 'home';
      else if (game.awayTeam && String(game.awayTeam).toLowerCase() === 'florida') homeAway = 'away';

      for (const cat of team.categories || []) {
        const category = normalizeCategory(cat.name || cat.category);
        if (!category) continue;
        for (const typ of cat.types || []) {
          const typeName = String(typ.name || typ.statType || '').toUpperCase();
          const dest = STAT_TYPE_MAP[typeName];
          if (!dest) continue;
          for (const athlete of typ.athletes || []) {
            const name = String(athlete.name || '').trim();
            const id = athlete.id != null ? Number(athlete.id) : null;
            const pkey = Number.isFinite(id) ? `id:${id}` : name ? `name:${name.toLowerCase()}` : null;
            if (!pkey) continue;
            const n = toNum(athlete.stat);
            if (n == null) continue;
            if (!byPlayer.has(pkey)) byPlayer.set(pkey, []);
            const games = byPlayer.get(pkey);
            let g = games.find(
              (x) =>
                x.season === seasonYear &&
                x.week === week &&
                x.opponent === opponent &&
                x._cat === category
            );
            if (!g) {
              g = {
                season: seasonYear,
                week: Number.isFinite(week) ? week : null,
                date: date ? String(date) : null,
                opponent,
                homeAway,
                stats: {},
                _cat: category,
              };
              games.push(g);
            }
            g.stats[dest] = n;
            if (Number.isFinite(id)) g._playerId = id;
            g._name = name;
          }
        }
      }
    }
  }

  const out = new Map();
  for (const [pkey, games] of byPlayer) {
    const cleaned = games
      .filter((g) => Object.keys(g.stats).length > 0)
      .map(({ _cat, _playerId, _name, ...rest }) => ({
        ...rest,
        category: _cat,
        playerId: _playerId ?? null,
        name: _name || null,
      }))
      .sort((a, b) => {
        const da = a.date || '';
        const db = b.date || '';
        if (da !== db) return db.localeCompare(da);
        return (b.week || 0) - (a.week || 0);
      });
    out.set(pkey, cleaned);
  }
  return out;
}

function primaryCategoryForPos(pos) {
  const p = String(pos || '').toUpperCase();
  if (p === 'QB') return 'passing';
  if (['RB', 'FB', 'HB', 'TB'].includes(p)) return 'rushing';
  if (['WR', 'TE', 'ATH'].includes(p)) return 'receiving';
  if (['K', 'PK'].includes(p)) return 'kicking';
  if (p === 'P') return 'punting';
  return 'defense';
}

/**
 * Build productionStats object for one matched roster player.
 */
function buildProductionStats({
  match,
  seasonAgg,
  gameAggBySeason,
  rosterPos,
  syncedAt,
}) {
  const keys = [];
  if (match.playerId != null) keys.push(`id:${match.playerId}`);
  if (match.cfbdName) keys.push(`name:${String(match.cfbdName).trim().toLowerCase()}`);

  let seasons = [];
  let playerId = match.playerId;
  for (const k of keys) {
    const hit = seasonAgg.get(k);
    if (hit?.seasons?.length) {
      seasons = hit.seasons;
      if (hit.playerId != null) playerId = hit.playerId;
      break;
    }
  }

  const primary = primaryCategoryForPos(rosterPos);
  const collected = [];
  if (gameAggBySeason && typeof gameAggBySeason.forEach === 'function') {
    gameAggBySeason.forEach((byPlayer) => {
      for (const k of keys) {
        const games = byPlayer.get(k);
        if (games?.length) collected.push(...games);
      }
    });
  }
  collected.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  let filtered = collected.filter((g) => g.category === primary);
  if (!filtered.length) filtered = collected;

  const recentGames = [];
  const seen = new Set();
  for (const g of filtered) {
    const sk = `${g.season}|${g.week}|${g.opponent}`;
    if (seen.has(sk)) continue;
    seen.add(sk);
    recentGames.push({
      season: g.season,
      week: g.week,
      date: g.date,
      opponent: g.opponent,
      homeAway: g.homeAway,
      category: g.category,
      stats: g.stats,
    });
    if (recentGames.length >= 8) break;
  }

  if (!seasons.length && !recentGames.length) return null;

  return {
    source: 'cfbd',
    syncedAt,
    cfbdPlayerId: playerId != null && Number.isFinite(Number(playerId)) ? Number(playerId) : null,
    matchConfidence: match.confidence,
    seasons,
    recentGames,
  };
}

module.exports = {
  normalizeCategory,
  aggregateSeasonStats,
  aggregateGameStats,
  primaryCategoryForPos,
  buildProductionStats,
  STAT_TYPE_MAP,
};