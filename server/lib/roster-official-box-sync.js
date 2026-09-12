/**
 * Pull official UF box scores and stamp every roster player who recorded a line.
 * Discovers each week's box from the UF game-center page so stats stay API-only
 * after the one-time 1.0.25 Stats-tab bake — no weekly Codemagic.
 */
'use strict';

const rosterStore = require('./roster-store');
const scheduleBoard = require('./schedule-board');
const { parseOfficialBoxHtml, parseBoxMeta } = require('./roster-official-box-parse');
const { applyOfficialGameLines } = require('./roster-production-merge');

const FETCH_UA =
  'Mozilla/5.0 (compatible; GatorVaultRosterStats/1.0; +https://gatorvaultinsider.com)';
const BOX_HREF_RE = /\/sports\/football\/stats\/(\d{4})\/[^"'\\\s>]+\/boxscore\/\d+/gi;
const MONTHS = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

function isBye(game) {
  return /^bye/i.test(String(game?.id || game?.label || ''));
}

function isComplete(game) {
  return Number.isFinite(Number(game?.finalUF)) && Number.isFinite(Number(game?.finalOpp));
}

function playableGames(board) {
  return (board?.games || []).filter((g) => !isBye(g));
}

function weekForGame(board, game) {
  const playable = playableGames(board);
  const idx = playable.findIndex((g) => g.id === game.id);
  return idx >= 0 ? idx + 1 : null;
}

function homeAwayForGame(game) {
  const venue = String(game?.venue || '');
  const label = String(game?.label || '');
  if (/@/.test(label) || /Mercedes|Atlanta|away/i.test(venue)) return 'away';
  if (/Ben Hill|Gainesville|vs /i.test(`${venue} ${label}`)) return 'home';
  return 'home';
}

function gameCenterUrl(game) {
  return String(game?.tickets?.gameCenter || '').trim();
}

function absoluteUfUrl(href) {
  const path = String(href || '').trim();
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `https://floridagators.com${path.startsWith('/') ? path : `/${path}`}`;
}

function extractBoxScoreUrl(html, season) {
  const year = String(season || '');
  const hits = [...String(html || '').matchAll(BOX_HREF_RE)];
  if (!hits.length) return null;
  const match = hits.find((m) => m[1] === year) || hits[0];
  return absoluteUfUrl(match[0]);
}

function newYorkYmd(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const pick = (type) => Number(parts.find((p) => p.type === type)?.value);
  return { year: pick('year'), month: pick('month'), day: pick('day') };
}

function gameCalendarDate(game) {
  const raw = String(game?.date || '');
  const m = raw.match(
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})/i
  );
  if (!m) return null;
  return {
    year: Number(m[3]),
    month: MONTHS[m[1].toLowerCase()] + 1,
    day: Number(m[2]),
  };
}

function gameDayReached(game, now = new Date()) {
  if (isComplete(game) || String(game?.boxScoreUrl || '').trim()) return true;
  const gameDay = gameCalendarDate(game);
  if (!gameDay) return false;
  const today = newYorkYmd(now);
  const gameStamp = Date.UTC(gameDay.year, gameDay.month - 1, gameDay.day);
  const todayStamp = Date.UTC(today.year, today.month - 1, today.day);
  return gameStamp <= todayStamp;
}

function candidateGames(board, now = new Date()) {
  return playableGames(board).filter((g) => {
    if (!gameDayReached(g, now)) return false;
    return Boolean(String(g.boxScoreUrl || '').trim() || gameCenterUrl(g));
  });
}

function completedBoxes(board) {
  return playableGames(board).filter((g) => isComplete(g) && String(g.boxScoreUrl || '').trim());
}

async function fetchBoxHtml(url) {
  const resp = await fetch(url, {
    headers: { Accept: 'text/html', 'User-Agent': FETCH_UA },
  });
  if (!resp.ok) {
    const err = new Error(`Official box ${resp.status} ${url}`);
    err.status = resp.status;
    throw err;
  }
  return resp.text();
}

function gameDateIso(game) {
  const raw = String(game?.date || '');
  const m = raw.match(
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})/i
  );
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[3]), MONTHS[m[1].toLowerCase()], Number(m[2]), 23, 55, 0));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function resolveBoxScoreUrl(game, opts = {}) {
  const existing = String(game?.boxScoreUrl || '').trim();
  if (existing) return existing;
  const gc = gameCenterUrl(game);
  if (!gc) return null;
  const html = opts.gameCenterHtml || (await fetchBoxHtml(gc));
  return extractBoxScoreUrl(html, opts.season);
}

function persistDiscoveredBox(board, gameId, boxScoreUrl) {
  if (!boxScoreUrl) return { persisted: false };
  const current = (board.games || []).find((g) => g.id === gameId);
  if (String(current?.boxScoreUrl || '').trim() === boxScoreUrl) {
    return { persisted: false };
  }
  const nextGames = (board.games || []).map((g) =>
    g.id === gameId ? { ...g, boxScoreUrl } : g
  );
  scheduleBoard.saveScheduleBoard(
    {
      ...board,
      games: nextGames,
      updatedAt: new Date().toISOString(),
    },
    board.season
  );
  return { persisted: true, boxScoreUrl };
}

function officialOpponentName(game, meta) {
  if (/^FAU/i.test(String(game.id)) || /FAU|Florida Atlantic/i.test(String(game.opp))) {
    return 'Florida Atlantic';
  }
  return (
    meta.opponent ||
    String(game.opp || '')
      .replace(/\s+Owls$/i, '')
      .replace(/\s+Camels$/i, '')
      .replace(/^FAU$/i, 'Florida Atlantic') ||
    'Opponent'
  );
}

function addedOfficialLines(existing, next) {
  if (!next) return false;
  if (!existing) return true;
  return (next.recentGames || []).length > (existing.recentGames || []).length;
}

async function syncOfficialBoxForGame(game, board, opts = {}) {
  const url = opts.boxScoreUrl || (await resolveBoxScoreUrl(game, { ...opts, season: board.season }));
  if (!url) {
    return { ok: true, skipped: true, gameId: game.id, reason: 'box not posted yet' };
  }
  const html = opts.html || (await fetchBoxHtml(url));
  const roster = rosterStore.loadPlayersRaw();
  const parsed = parseOfficialBoxHtml(html, roster);
  if (!parsed.size) {
    return { ok: true, skipped: true, gameId: game.id, reason: 'box has no roster lines yet', url };
  }
  const meta = parseBoxMeta(html, {
    opponent: officialOpponentName(game, {}),
    homeAway: homeAwayForGame(game),
  });
  const gameMeta = {
    season: Number(board.season || 2026),
    week: weekForGame(board, game),
    date: gameDateIso(game),
    opponent: officialOpponentName(game, meta),
    homeAway: meta.homeAway,
  };
  const syncedAt = opts.syncedAt || new Date().toISOString();
  const updates = {};
  for (const [slug, hit] of parsed) {
    const player = roster.find((p) => p.slug === slug);
    const next = applyOfficialGameLines(player?.productionStats || null, gameMeta, hit.lines, syncedAt);
    if (addedOfficialLines(player?.productionStats || null, next)) updates[slug] = next;
  }
  const write = opts.dryRun
    ? { changed: Object.keys(updates).length }
    : Object.keys(updates).length
      ? rosterStore.applyProductionStatsUpdates(updates)
      : { changed: 0 };
  const persisted =
    opts.dryRun || opts.persistSchedule === false
      ? { persisted: false }
      : persistDiscoveredBox(board, game.id, url);
  return {
    ok: true,
    skipped: false,
    gameId: game.id,
    week: gameMeta.week,
    opponent: gameMeta.opponent,
    url,
    matched: parsed.size,
    changed: write.changed || 0,
    slugs: Object.keys(updates),
    persistedBoxUrl: persisted.persisted === true,
  };
}

async function syncRosterOfficialBoxes(opts = {}) {
  const season = Number(opts.season || process.env.ROSTER_STATS_SEASON || 2026);
  const board = scheduleBoard.getScheduleBoard(season);
  const games = candidateGames(board, opts.now);
  if (!games.length) {
    return { ok: true, skipped: true, reason: 'no probeable official boxes', season, games: 0 };
  }

  const results = [];
  const errors = [];
  for (const game of games) {
    if (opts.gameId && game.id !== opts.gameId) continue;
    try {
      results.push(await syncOfficialBoxForGame(game, board, opts));
    } catch (err) {
      errors.push(`${game.id}: ${err.message}`);
    }
  }

  const applied = results.filter((r) => !r.skipped);
  return {
    ok: errors.length === 0,
    skipped: applied.length === 0,
    season,
    games: results.length,
    matched: applied.reduce((n, r) => n + (r.matched || 0), 0),
    changed: applied.reduce((n, r) => n + (r.changed || 0), 0),
    results,
    errors: errors.length ? errors : undefined,
  };
}

module.exports = {
  syncRosterOfficialBoxes,
  syncOfficialBoxForGame,
  completedBoxes,
  candidateGames,
  weekForGame,
  homeAwayForGame,
  extractBoxScoreUrl,
  gameDayReached,
  resolveBoxScoreUrl,
};
