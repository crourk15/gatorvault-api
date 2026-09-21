/**
 * Game Week Swing Impact — restamps each week from official 2026 box form
 * plus this opponent's rush/pass look. Never invents a line that is not
 * on the roster official box / already-written game copy.
 */
'use strict';

const SLUG_ALIASES = {
  'jaden-baugh': 'jadan-baugh',
};

const NAME_SLUGS = {
  'Jadan Baugh': 'jadan-baugh',
  'Jaden Baugh': 'jadan-baugh',
  'Aaron Philo': 'aaron-philo',
  'Jayden Woods': 'jayden-woods',
  'Myles Graham': 'myles-graham',
  'Cormani McClain': 'cormani-mcclain',
  'Eric Singleton Jr.': 'eric-singleton-jr',
  'Singleton Jr.': 'eric-singleton-jr',
  'Dallas Wilson': 'dallas-wilson',
};

/** Identity floors — Baugh is the offense engine, never a 72 role card. */
const IDENTITY_FLOOR = {
  'jadan-baugh': 88,
  'aaron-philo': 82,
  'jayden-woods': 84,
  'myles-graham': 84,
  'dallas-wilson': 82,
  'eric-singleton-jr': 83,
  'cormani-mcclain': 82,
};

const DEFAULT_FLOOR = 78;
const CACHE_MS = 5 * 60 * 1000;

let productionCache = { at: 0, bySlug: null };

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function slugifyName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function swingSlug(name) {
  const mapped = NAME_SLUGS[String(name || '').trim()];
  if (mapped) return mapped;
  const raw = slugifyName(name);
  return SLUG_ALIASES[raw] || raw;
}

function playableGames(board) {
  return (board?.games || []).filter((g) => g && g.kind !== 'bye' && !/^bye/i.test(String(g.id || '')));
}

function weekForGame(board, game) {
  const playable = playableGames(board);
  const idx = playable.findIndex((g) => g.id === game?.id);
  return idx >= 0 ? idx + 1 : null;
}

function gameCopy(game, role) {
  return [
    role,
    game?.film,
    ...(game?.filmNotes || []),
    ...(game?.defenseTendencies || []),
    ...(game?.howUFWins || []),
    ...(game?.keys || []),
  ]
    .filter(Boolean)
    .join(' ');
}

function num(stats, key) {
  const n = Number(stats?.[key]);
  return Number.isFinite(n) ? n : 0;
}

function seasonLines(production, season, week, category) {
  const games = Array.isArray(production?.recentGames) ? production.recentGames : [];
  return games.filter((row) => {
    if (Number(row?.season) !== season) return false;
    if (category && row.category !== category) return false;
    const w = Number(row.week);
    if (!Number.isFinite(w)) return false;
    if (week == null) return true;
    return w < week;
  });
}

function lastLine(lines) {
  if (!lines.length) return null;
  return [...lines].sort((a, b) => Number(b.week) - Number(a.week))[0];
}

function rbFormAdj(lines) {
  if (!lines.length) return 0;
  const last = lastLine(lines);
  const yds = num(last?.stats, 'yds');
  const td = num(last?.stats, 'td');
  let adj = 0;
  if (yds >= 150) adj += 6;
  else if (yds >= 130) adj += 5;
  else if (yds >= 100) adj += 3;
  else if (yds >= 80) adj += 2;
  else if (yds < 40 && td === 0) adj -= 3;
  else if (yds < 70 && td === 0) adj -= 1;
  if (td >= 3) adj += 3;
  else if (td >= 2) adj += 2;
  else if (td === 1) adj += 1;
  return adj;
}

function qbFormAdj(lines) {
  if (!lines.length) return 0;
  const last = lastLine(lines);
  const yds = num(last?.stats, 'yds');
  const td = num(last?.stats, 'td');
  const ints = num(last?.stats, 'int');
  let adj = 0;
  if (yds >= 250) adj += 4;
  else if (yds >= 200) adj += 3;
  else if (yds >= 150) adj += 2;
  if (td >= 3) adj += 3;
  else if (td === 2) adj += 2;
  else if (td === 1) adj += 1;
  if (ints >= 2) adj -= 2;
  else if (ints === 1) adj -= 1;
  return adj;
}

function defFormAdj(lines) {
  if (!lines.length) return 0;
  const last = lastLine(lines);
  const tot = num(last?.stats, 'tot');
  const sack = num(last?.stats, 'sack');
  const tfl = num(last?.stats, 'tfl');
  let adj = 0;
  if (tot >= 8) adj += 3;
  else if (tot >= 5) adj += 2;
  else if (tot >= 3) adj += 1;
  if (sack >= 1) adj += 2;
  else if (tfl >= 1) adj += 1;
  return adj;
}

function wrFormAdj(lines) {
  if (!lines.length) return 0;
  const last = lastLine(lines);
  const yds = num(last?.stats, 'yds');
  const td = num(last?.stats, 'td');
  let adj = 0;
  if (yds >= 100) adj += 4;
  else if (yds >= 60) adj += 2;
  if (td >= 1) adj += 2;
  return adj;
}

function rushLook(copy) {
  const t = String(copy || '');
  const held = /held[^.]*?\b(\d{2,3})\b[^.]*?rush|to\s+(\d{2,3})\s+(?:rush|on the ground)/i.exec(t);
  if (held) {
    const n = Number(held[1] || held[2]);
    if (n > 0 && n <= 120) return { allowed: n, soft: false };
  }
  const ypg = /(\d{2,3})\s*rush(?:ing)?\s*(?:yards?\s*)?(?:a game|ypg)/i.exec(t);
  if (ypg) return { allowed: Number(ypg[1]), soft: Number(ypg[1]) >= 130 };
  const gave = /(?:ran for|gave\b[^.]*?)\s+(\d{2,3})\b/i.exec(t);
  if (gave) return { allowed: Number(gave[1]), soft: Number(gave[1]) >= 150 };
  return null;
}

function passLook(copy) {
  const t = String(copy || '');
  const threw = /threw(?: for)?\s+(\d{3})\b/i.exec(t);
  if (threw) return { allowed: Number(threw[1]), soft: Number(threw[1]) >= 280 };
  const tds = /(\d{2})\s+pass\s+tds?/i.exec(t);
  if (tds) return { allowed: Number(tds[1]), soft: Number(tds[1]) >= 20 };
  return null;
}

function radarOpp(game, label) {
  const axis = (game?.radar || []).find((a) => String(a?.label || '').toLowerCase() === label.toLowerCase());
  const n = Number(axis?.opp);
  return Number.isFinite(n) ? n : null;
}

function rbMatchupAdj(game, role) {
  const copy = gameCopy(game, role);
  const look = rushLook(copy);
  let adj = 0;
  if (look) {
    if (look.soft || look.allowed >= 160) adj += 4;
    else if (look.allowed >= 130) adj += 3;
    else if (look.allowed <= 110) adj -= 2;
  }
  const front = radarOpp(game, 'Front 7');
  if (front != null && front <= 52) adj += 2;
  if (front != null && front >= 72) adj -= 2;
  return adj;
}

function qbMatchupAdj(game, role) {
  const copy = gameCopy(game, role);
  const look = passLook(copy);
  let adj = 0;
  if (look?.soft) adj += 2;
  const pass = radarOpp(game, 'Pass Efficiency');
  if (pass != null && pass >= 72) adj += 1;
  return adj;
}

function edgeMatchupAdj(game, role) {
  const copy = gameCopy(game, role);
  let adj = 0;
  if (/\bno-huddle|keep (?:it|him)|in the pocket|crowd\b/i.test(copy)) adj += 3;
  return adj;
}

function familyForSlug(slug, production) {
  const pos = String(production?.pos || '').toLowerCase();
  if (slug === 'jadan-baugh' || pos === 'rb') return 'rb';
  if (slug === 'aaron-philo' || pos === 'qb') return 'qb';
  if (slug === 'dallas-wilson' || slug === 'eric-singleton-jr' || pos === 'wr') return 'wr';
  return 'def';
}

function formAdj(family, production, season, week) {
  if (family === 'rb') return rbFormAdj(seasonLines(production, season, week, 'rushing'));
  if (family === 'qb') return qbFormAdj(seasonLines(production, season, week, 'passing'));
  if (family === 'wr') return wrFormAdj(seasonLines(production, season, week, 'receiving'));
  return defFormAdj(seasonLines(production, season, week, 'defense'));
}

function matchupAdj(family, game, role) {
  if (family === 'rb') return rbMatchupAdj(game, role);
  if (family === 'qb') return qbMatchupAdj(game, role);
  if (family === 'wr') return qbMatchupAdj(game, role);
  return edgeMatchupAdj(game, role);
}

function trendFromForm(family, production, season, week) {
  const cat = family === 'rb' ? 'rushing' : family === 'qb' ? 'passing' : family === 'wr' ? 'receiving' : 'defense';
  const last = lastLine(seasonLines(production, season, week, cat));
  if (!last) return 'up';
  if (family === 'rb') {
    const yds = num(last.stats, 'yds');
    const td = num(last.stats, 'td');
    if (yds >= 100 || td >= 2) return 'up';
    if (yds < 50 && td === 0) return 'down';
    return 'flat';
  }
  if (family === 'qb') {
    const yds = num(last.stats, 'yds');
    const td = num(last.stats, 'td');
    if (yds >= 200 || td >= 2) return 'up';
    if (num(last.stats, 'int') >= 2) return 'down';
    return 'flat';
  }
  if (family === 'wr') {
    if (num(last.stats, 'yds') >= 80 || num(last.stats, 'td') >= 1) return 'up';
    return 'flat';
  }
  if (num(last.stats, 'tot') >= 5 || num(last.stats, 'sack') >= 0.5) return 'up';
  return 'flat';
}

function loadProductionBySlug() {
  if (productionCache.bySlug && Date.now() - productionCache.at < CACHE_MS) {
    return productionCache.bySlug;
  }
  const rosterStore = require('./roster-store');
  const map = {};
  for (const player of rosterStore.loadPlayers()) {
    if (!player?.slug) continue;
    map[player.slug] = {
      pos: player.pos || player.position || '',
      productionStats: player.productionStats || null,
    };
  }
  productionCache = { at: Date.now(), bySlug: map };
  return map;
}

function clearSwingProductionCache() {
  productionCache = { at: 0, bySlug: null };
}

function computeSwingImpact(entry, game, board, productionBySlug) {
  const slug = swingSlug(entry?.name);
  const floor = IDENTITY_FLOOR[slug] ?? DEFAULT_FLOOR;
  const row = productionBySlug?.[slug] || null;
  const production = row?.productionStats || null;
  const family = familyForSlug(slug, row);
  const week = weekForGame(board, game);
  const season = Number(board?.season || 2026);
  const form = formAdj(family, production, season, week);
  const matchup = matchupAdj(family, game, entry?.role);
  const impact = clamp(floor + form + matchup, floor, 95);
  const trend = trendFromForm(family, production, season, week);
  return { impact, trend, slug, floor, form, matchup, week };
}

function decorateSwingRow(entry, game, board, productionBySlug) {
  const live = computeSwingImpact(entry, game, board, productionBySlug);
  return {
    name: entry.name,
    role: entry.role,
    impact: live.impact,
    trend: live.trend,
    slug: live.slug,
  };
}

function decorateGameSwing(game, board, productionBySlug) {
  if (!game || !Array.isArray(game.swing)) return game;
  const prod = productionBySlug || loadProductionBySlug();
  return {
    ...game,
    swing: game.swing.map((row) => decorateSwingRow(row, game, board, prod)),
  };
}

function decorateBoardSwing(board) {
  const prod = loadProductionBySlug();
  const games = (board?.games || []).map((game) => decorateGameSwing(game, board, prod));
  return { ...board, games };
}

module.exports = {
  IDENTITY_FLOOR,
  swingSlug,
  weekForGame,
  computeSwingImpact,
  decorateSwingRow,
  decorateGameSwing,
  decorateBoardSwing,
  loadProductionBySlug,
  clearSwingProductionCache,
  rushLook,
  rbFormAdj,
};
