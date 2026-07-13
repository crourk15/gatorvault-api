/**
 * Normalize names + match GV roster players to CFBD Florida rows.
 * Only exact / high-confidence matches — never invent production.
 */

function normalizePersonName(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`´]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameTokens(name) {
  return normalizePersonName(name).split(' ').filter(Boolean);
}

function positionGroup(pos) {
  const p = String(pos || '').toUpperCase().trim();
  if (!p) return null;
  if (['QB'].includes(p)) return 'qb';
  if (['RB', 'FB', 'TB', 'HB'].includes(p)) return 'rb';
  if (['WR', 'ATH'].includes(p)) return 'wr';
  if (['TE'].includes(p)) return 'te';
  if (['OL', 'OT', 'OG', 'C', 'IOL', 'T', 'G'].includes(p)) return 'ol';
  if (['DL', 'DE', 'DT', 'NT', 'EDGE'].includes(p)) return 'dl';
  if (['LB', 'ILB', 'OLB', 'MLB', 'WILL', 'MIKE', 'SAM', 'JACK', 'STAR'].includes(p)) return 'lb';
  if (['CB', 'S', 'SAF', 'FS', 'SS', 'DB', 'NB', 'NICKEL'].includes(p)) return 'db';
  if (['K', 'PK'].includes(p)) return 'k';
  if (['P'].includes(p)) return 'p';
  if (['LS'].includes(p)) return 'ls';
  return p.toLowerCase();
}

function cfbdPositionGroup(cfbdPos) {
  const p = String(cfbdPos || '').toUpperCase().trim();
  if (!p) return null;
  if (p.includes('QB')) return 'qb';
  if (p.includes('RB') || p.includes('FB')) return 'rb';
  if (p.includes('WR')) return 'wr';
  if (p.includes('TE')) return 'te';
  if (p.includes('OL') || p === 'OT' || p === 'OG' || p === 'C' || p === 'G' || p === 'T') return 'ol';
  if (p.includes('DL') || p.includes('DE') || p.includes('DT') || p.includes('NT')) return 'dl';
  if (p.includes('LB')) return 'lb';
  if (p.includes('DB') || p.includes('CB') || p === 'SAF' || p === 'S' || p === 'FS' || p === 'SS') return 'db';
  if (p === 'K' || p.includes('PK')) return 'k';
  if (p === 'P') return 'p';
  return positionGroup(p);
}

function positionsCompatible(rosterPos, cfbdPos) {
  const a = positionGroup(rosterPos);
  const b = cfbdPositionGroup(cfbdPos);
  if (!a || !b) return true;
  return a === b;
}

function indexCfbdPlayers(rows) {
  const byName = new Map();
  for (const row of rows || []) {
    const name = row.player || row.name || '';
    const key = normalizePersonName(name);
    if (!key) continue;
    const playerId =
      row.playerId != null
        ? Number(row.playerId)
        : row.id != null
          ? Number(row.id)
          : null;
    const entry = {
      playerId: Number.isFinite(playerId) ? playerId : null,
      name: String(name).trim(),
      position: row.position || row.pos || null,
    };
    if (!byName.has(key)) byName.set(key, []);
    const list = byName.get(key);
    if (!list.some((x) => x.playerId === entry.playerId && x.name === entry.name)) {
      list.push(entry);
    }
  }
  return byName;
}

function matchRosterToCfbd(rosterPlayer, cfbdIndex) {
  if (!rosterPlayer) return null;

  if (rosterPlayer.cfbdPlayerId != null && Number.isFinite(Number(rosterPlayer.cfbdPlayerId))) {
    return {
      confidence: 'exact',
      playerId: Number(rosterPlayer.cfbdPlayerId),
      cfbdName: rosterPlayer.name,
    };
  }

  const key = normalizePersonName(rosterPlayer.name);
  if (!key) return null;
  const candidates = cfbdIndex.get(key) || [];
  if (!candidates.length) return null;

  const posFiltered = candidates.filter((c) =>
    positionsCompatible(rosterPlayer.pos || rosterPlayer.position, c.position)
  );
  const pool = posFiltered.length ? posFiltered : candidates;

  if (pool.length === 1) {
    return {
      confidence: posFiltered.length === 1 ? 'exact' : 'high',
      playerId: pool[0].playerId,
      cfbdName: pool[0].name,
    };
  }

  if (posFiltered.length === 1) {
    return {
      confidence: 'exact',
      playerId: posFiltered[0].playerId,
      cfbdName: posFiltered[0].name,
    };
  }

  return null;
}

module.exports = {
  normalizePersonName,
  nameTokens,
  positionGroup,
  cfbdPositionGroup,
  positionsCompatible,
  indexCfbdPlayers,
  matchRosterToCfbd,
};
