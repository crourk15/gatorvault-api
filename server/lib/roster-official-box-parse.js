/**
 * Parse a floridagators.com / Sidearm box score into per-player category lines.
 * Only keep rows that match a UF roster name — never invent production.
 */
'use strict';

const { normalizePersonName, nameTokens } = require('./roster-production-stats-match');

function decodeEntities(text) {
  return String(text || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
    .replace(/&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function decodeCell(html) {
  return decodeEntities(
    String(html || '')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function parseHtmlTables(html) {
  const tables = [];
  const tableRe = /<table\b[\s\S]*?<\/table>/gi;
  for (const t of html.match(tableRe) || []) {
    const headers = [...t.matchAll(/s-table-header__column-label[^>]*>([^<]+)/g)].map((m) =>
      String(m[1] || '').replace(/\./g, '').trim()
    );
    const rows = [];
    const trRe = /<tr\b[\s\S]*?<\/tr>/gi;
    for (const tr of t.match(trRe) || []) {
      const cells = [...tr.matchAll(/<t[dh]\b[\s\S]*?<\/t[dh]>/gi)].map((td) => decodeCell(td[0]));
      if (cells.length) rows.push(cells);
    }
    if (headers.length || rows.length) tables.push({ headers, rows });
  }
  return tables;
}

function normHeader(h) {
  return String(h || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function classifyHeaders(headers) {
  const h = headers.map(normHeader);
  const has = (...keys) => keys.every((k) => h.includes(normHeader(k)));
  const madeCount = h.filter((x) => x === 'made').length;
  if (has('cmp', 'att') && (h.includes('int') || h.includes('yds'))) return 'passing';
  if (has('att', 'net') && h.includes('td')) return 'rushing';
  if (has('rec') && h.includes('yds') && !h.includes('cmp')) return 'receiving';
  if (has('solo', 'tot') || has('solo', 'ast')) return 'defense';
  if (h.includes('fgm') || h.includes('xpm') || (has('att', 'made') && h.includes('kicks'))) {
    return 'kicking';
  }
  if (has('qtr', 'result') && (h.includes('yds') || h.includes('clock'))) return 'fieldGoals';
  if (has('att', 'made') && madeCount >= 2 && !h.includes('cmp') && !h.includes('rec')) {
    return 'kickingConversions';
  }
  if (h.includes('punts') && (h.includes('in20') || h.includes('tb') || h.includes('avg'))) {
    return 'punting';
  }
  if (h.filter((x) => x === 'ret').length >= 2 && h.includes('yds')) return 'returning';
  return null;
}

function headerIndex(headers, names) {
  const h = headers.map(normHeader);
  for (const name of names) {
    const i = h.indexOf(normHeader(name));
    if (i >= 0) return i;
  }
  return -1;
}

function dataOffset(headers, row) {
  const firstH = normHeader(headers[0] || '');
  if (firstH === 'player' || firstH === 'name') return 0;
  const first = String(row[0] || '').trim();
  if (first && !/^\d/.test(first) && !/^totals?$/i.test(first)) return 1;
  return 0;
}

function numAt(row, idx) {
  if (idx < 0 || idx >= row.length) return null;
  const raw = String(row[idx] || '').replace(/[^\d.+-]/g, '');
  if (raw === '' || raw === '-' || raw === '—') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function firstIntToken(raw) {
  const m = String(raw || '').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function statsFromRow(category, headers, row) {
  const off = dataOffset(headers, row);
  const at = (names) => {
    const i = headerIndex(headers, names);
    return i < 0 ? -1 : i + off;
  };
  if (category === 'passing') {
    const cmp = numAt(row, at(['cmp']));
    const att = numAt(row, at(['att']));
    const yds = numAt(row, at(['yds']));
    const td = numAt(row, at(['td']));
    const int = numAt(row, at(['int']));
    const lng = numAt(row, at(['long', 'lng']));
    if (cmp == null && att == null && yds == null) return null;
    const stats = { cmp, att, yds, td, int, lng };
    if (att && yds != null) stats.avg = Math.round((yds / att) * 10) / 10;
    return compact(stats);
  }
  if (category === 'rushing') {
    const car = numAt(row, at(['att']));
    const yds = numAt(row, at(['net', 'yds']));
    const td = numAt(row, at(['td']));
    const lng = numAt(row, at(['lg', 'long', 'lng']));
    if (car == null && yds == null) return null;
    const stats = { car, yds, td, lng };
    if (car && yds != null) stats.avg = Math.round((yds / car) * 10) / 10;
    return compact(stats);
  }
  if (category === 'receiving') {
    const rec = numAt(row, at(['rec', 'no']));
    const yds = numAt(row, at(['yds']));
    const td = numAt(row, at(['td']));
    const lng = numAt(row, at(['long', 'lng']));
    if (rec == null && yds == null) return null;
    const stats = { rec, yds, td, lng };
    if (rec && yds != null) stats.avg = Math.round((yds / rec) * 10) / 10;
    return compact(stats);
  }
  if (category === 'defense') {
    const solo = numAt(row, at(['solo']));
    const ast = numAt(row, at(['ast']));
    const tot = numAt(row, at(['tot']));
    const tfl = firstIntToken(row[at(['tflyds', 'tfl'])]);
    const sack = firstIntToken(row[at(['sackyds', 'sack'])]);
    const ff = numAt(row, at(['ff']));
    const pd = numAt(row, at(['brup', 'pd']));
    const qh = numAt(row, at(['qh']));
    const int = firstIntToken(row[at(['int'])]);
    const fr = firstIntToken(row[at(['fryds', 'fr'])]);
    if (solo == null && ast == null && tot == null && sack == null && int == null) return null;
    if (!solo && !ast && !tot && !sack && !int && !pd && !ff && !qh && !tfl && !fr) return null;
    return compact({ solo, ast, tot, tfl, sack, ff, pd, qh, int, fr });
  }
  if (category === 'kicking') {
    const fgm = numAt(row, at(['fgm']));
    const fga = numAt(row, at(['fga']));
    const xpm = numAt(row, at(['xpm', 'made']));
    const xpa = numAt(row, at(['xpa', 'att']));
    const pts = numAt(row, at(['pts']));
    const lng = numAt(row, at(['lng', 'long']));
    if (fgm == null && xpm == null && pts == null) return null;
    return compact({ fgm, fga, xpm, xpa, pts, lng });
  }
  if (category === 'fieldGoals') {
    const yds = numAt(row, at(['yds']));
    const result = String(row[at(['result'])] || row[row.length - 1] || '').toUpperCase();
    if (!result || /NO FIELD/i.test(result)) return null;
    const good = /\bGOOD\b/.test(result);
    return compact({ fgm: good ? 1 : 0, fga: 1, lng: good ? yds : null });
  }
  if (category === 'kickingConversions') {
    const xpa = numAt(row, off + headerIndex(headers, ['att']));
    const xpm = numAt(row, off + headerIndex(headers, ['made']));
    if (xpa == null && xpm == null) return null;
    if (!xpa && !xpm) return null;
    return compact({ xpm: xpm || 0, xpa: xpa || 0 });
  }
  if (category === 'punting') {
    const punts = numAt(row, at(['punts']));
    const yds = numAt(row, at(['yds']));
    const avg = numAt(row, at(['avg']));
    const lng = numAt(row, at(['long', 'lng']));
    const in20 = numAt(row, at(['in20', 'in 20']));
    const tb = numAt(row, at(['tb']));
    if (!punts) return null;
    return compact({ punts, yds, avg, lng, in20, tb });
  }
  if (category === 'returning') {
    const pr = numAt(row, off + 1);
    const prYds = numAt(row, off + 2);
    const kr = numAt(row, off + 4);
    const krYds = numAt(row, off + 5);
    if (!pr && !kr && !prYds && !krYds) return null;
    return compact({ pr: pr || 0, prYds: prYds || 0, kr: kr || 0, krYds: krYds || 0 });
  }
  return null;
}

function kickingPoints(stats) {
  const fgm = Number(stats?.fgm) || 0;
  const xpm = Number(stats?.xpm) || 0;
  if (stats?.fgm == null && stats?.xpm == null) return stats;
  return { ...stats, pts: fgm * 3 + xpm };
}

function compact(stats) {
  const out = {};
  for (const [k, v] of Object.entries(stats)) {
    if (v != null) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

function playerNameFromRow(row) {
  const raw = String(row[0] || '').trim();
  if (!raw || /^totals?$/i.test(raw) || /^team$/i.test(raw) || /^player$/i.test(raw)) return null;
  if (/^no\s+.+\s+statistics/i.test(raw)) return null;
  return raw.replace(/\s+/g, ' ');
}

function nameKey(name) {
  return nameTokens(name).slice().sort().join(' ');
}

function indexRosterByName(players) {
  const byKey = new Map();
  for (const p of players || []) {
    const key = nameKey(p.name);
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(p);
  }
  return byKey;
}

function matchRosterPlayer(name, rosterIndex) {
  const key = nameKey(name);
  if (!key) return null;
  const hits = rosterIndex.get(key) || [];
  return hits.length === 1 ? hits[0] : null;
}

/**
 * @returns {Map<string, { slug: string, name: string, lines: object[] }>}
 */
function parseOfficialBoxHtml(html, rosterPlayers) {
  const rosterIndex = indexRosterByName(rosterPlayers);
  const bySlug = new Map();
  const tables = parseHtmlTables(html);

  for (const table of tables) {
    const category = classifyHeaders(table.headers);
    if (!category) continue;
    for (const row of table.rows) {
      const name = playerNameFromRow(row);
      if (!name) continue;
      const player = matchRosterPlayer(name, rosterIndex);
      if (!player) continue;
      const stats = statsFromRow(category, table.headers, row);
      if (!stats) continue;
      const storeCategory =
        category === 'fieldGoals' || category === 'kickingConversions' ? 'kicking' : category;
      if (!bySlug.has(player.slug)) {
        bySlug.set(player.slug, { slug: player.slug, name: player.name, lines: [] });
      }
      const bucket = bySlug.get(player.slug);
      const existing = bucket.lines.find((l) => l.category === storeCategory);
      if (existing) {
        const { addStatMaps } = require('./roster-production-merge');
        existing.stats = addStatMaps(existing.stats, stats);
        if (storeCategory === 'kicking') existing.stats = kickingPoints(existing.stats);
      } else {
        bucket.lines.push({
          category: storeCategory,
          stats: storeCategory === 'kicking' ? kickingPoints(stats) : stats,
        });
      }
    }
  }
  return bySlug;
}

function parseBoxMeta(html, fallback = {}) {
  const text = decodeCell(String(html || '').slice(0, 20000));
  let opponent = fallback.opponent || null;
  const vs = text.match(/vs\.?\s+([A-Za-z .]+?)(?:\s+on|\s+\d|$)/i);
  const at = text.match(/at\s+([A-Za-z .]+?)(?:\s+on|\s+\d|$)/i);
  if (vs) opponent = vs[1].trim();
  else if (at) opponent = at[1].trim();
  if (/florida atlantic|fla\.?\s*atlantic|\bfau\b/i.test(String(html))) {
    opponent = opponent && !/florida$/i.test(opponent) ? opponent : 'Florida Atlantic';
  }
  return {
    opponent: opponent || fallback.opponent || 'Opponent',
    homeAway: fallback.homeAway || 'home',
  };
}

module.exports = {
  parseHtmlTables,
  classifyHeaders,
  parseOfficialBoxHtml,
  parseBoxMeta,
  nameKey,
  matchRosterPlayer,
  indexRosterByName,
  normalizePersonName,
  decodeEntities,
  kickingPoints,
};
