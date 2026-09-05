/**
 * Florida-only live scoreboard from ESPN CFB scoreboard.
 * Hidden feed for Gators Live — not an ESPN embed.
 */
'use strict';

const { parseEasternKickoff } = require('./eastern-kickoff');

const PREGAME_HOURS = 3;
const POSTGAME_HOURS = 5;
const FLORIDA_TEAM_ID = '57';
const CACHE_MS = 20_000;

const UF_2026_GAMES = [
  { id: 'fau', opp: 'FAU Owls', date: 'September 5, 2026 7:45 PM ET' },
  { id: 'campbell', opp: 'Campbell Camels', date: 'September 12, 2026 5:30 PM ET' },
  { id: 'auburn', opp: 'Auburn Tigers', date: 'September 19, 2026 7:00 PM ET' },
  { id: 'ole-miss', opp: 'Ole Miss Rebels', date: 'September 26, 2026 TBA' },
  { id: 'missouri', opp: 'Missouri Tigers', date: 'October 3, 2026 TBA' },
  { id: 'south-carolina', opp: 'South Carolina Gamecocks', date: 'October 10, 2026 TBA' },
  { id: 'texas', opp: 'Texas Longhorns', date: 'October 17, 2026 TBA' },
  { id: 'georgia', opp: 'Georgia Bulldogs', date: 'October 31, 2026 3:30 PM ET' },
  { id: 'kentucky', opp: 'Kentucky Wildcats', date: 'November 14, 2026 TBA' },
  { id: 'vanderbilt', opp: 'Vanderbilt Commodores', date: 'November 21, 2026 TBA' },
  { id: 'fsu', opp: 'Florida State Seminoles', date: 'November 27, 2026 TBA' },
];

let scoreboardCache = { at: 0, data: null };

async function httpGetJson(url, headers) {
  const impl = typeof fetch === 'function' ? fetch : require('node-fetch');
  const res = await impl(url, { headers, timeout: 20_000 });
  if (!res.ok) throw new Error(`espn_scoreboard_${res.status}`);
  return res.json();
}

function ordinalPeriod(period) {
  const n = Number(period);
  if (!Number.isFinite(n) || n < 1) return null;
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  if (n === 4) return '4th';
  return `OT${n - 4 === 1 ? '' : n - 4}`;
}

function isInProgressState(state) {
  return /in|live|halftime|end.?period|end.?half/i.test(state || '');
}

function isPrematchState(state) {
  return /pre|sched|status_scheduled/i.test(state || '') || !state;
}

function extractFloridaGame(scoreboard) {
  const events = scoreboard?.events || [];
  for (const event of events) {
    const comps = event.competitions || [];
    for (const comp of comps) {
      const competitors = comp.competitors || [];
      const florida = competitors.find(
        (c) => String(c.team?.id) === FLORIDA_TEAM_ID || /florida/i.test(c.team?.displayName || '')
      );
      if (!florida) continue;
      const opponent = competitors.find((c) => c !== florida);
      const type = comp.status?.type || {};
      const state = String(type.name || type.state || '').toLowerCase();
      const completed = Boolean(type.completed) || /final/i.test(state);
      const live = !completed && isInProgressState(state);
      const clock = String(comp.status?.displayClock || '').trim() || null;
      const period = Number(comp.status?.period) || null;
      const detail = String(type.detail || type.shortDetail || '').trim();
      const ufScore = florida.score != null && florida.score !== '' ? Number(florida.score) : null;
      const oppScore = opponent?.score != null && opponent.score !== '' ? Number(opponent.score) : null;

      return {
        eventId: String(event.id || comp.id || ''),
        opponent: opponent?.team?.displayName || opponent?.team?.shortDisplayName || 'Opponent',
        opponentShort:
          opponent?.team?.abbreviation || opponent?.team?.shortDisplayName || opponent?.team?.displayName || 'OPP',
        ufScore: Number.isFinite(ufScore) ? ufScore : null,
        oppScore: Number.isFinite(oppScore) ? oppScore : null,
        state,
        completed,
        live,
        clock,
        period,
        detail,
        possession: comp.situation?.possession || null,
      };
    }
  }
  return null;
}

function buildStatusLine(game) {
  if (!game) return 'Scheduled';
  if (game.completed) return game.detail && /final/i.test(game.detail) ? game.detail : 'Final';
  if (/halftime/i.test(game.detail || '') || /halftime/i.test(game.state || '')) return 'Halftime';
  const q = ordinalPeriod(game.period);
  if (game.live && q && game.clock) return q + ' quarter · ' + game.clock;
  if (game.live && game.detail) {
    return /live|in progress|halftime/i.test(game.detail) ? game.detail : 'In progress · ' + game.detail;
  }
  if (game.live) return 'In progress';
  return game.detail || 'Scheduled';
}

function toBettingOverlay(game) {
  if (!game) return null;
  return {
    homeScore: game.ufScore,
    awayScore: game.oppScore,
    status: buildStatusLine(game),
    clock: game.clock,
    period: game.period,
    live: game.live,
    completed: game.completed,
    scoreSource: 'espn',
  };
}

function featuredUfGame(now = new Date()) {
  const t = now.getTime();
  let current = null;
  let next = null;
  let nextTs = Infinity;
  for (const g of UF_2026_GAMES) {
    const kick = parseEasternKickoff(g.date);
    if (!kick) continue;
    const start = kick.getTime() - PREGAME_HOURS * 3600_000;
    const end = kick.getTime() + POSTGAME_HOURS * 3600_000;
    if (t >= start && t <= end) {
      current = { ...g, kickoffIso: kick.toISOString() };
      break;
    }
    if (kick.getTime() > t && kick.getTime() < nextTs) {
      nextTs = kick.getTime();
      next = { ...g, kickoffIso: kick.toISOString() };
    }
  }
  return current || next || { ...UF_2026_GAMES[0], kickoffIso: null };
}

function isUfGameLiveWindow(now = new Date()) {
  const t = now.getTime();
  for (const g of UF_2026_GAMES) {
    const kick = parseEasternKickoff(g.date);
    if (!kick) continue;
    const start = kick.getTime() - PREGAME_HOURS * 3600_000;
    const end = kick.getTime() + POSTGAME_HOURS * 3600_000;
    if (t >= start && t <= end) return true;
  }
  return false;
}

async function fetchEspnScoreboard({ force = false } = {}) {
  if (!force && scoreboardCache.data && Date.now() - scoreboardCache.at < CACHE_MS) {
    return scoreboardCache.data;
  }
  const url =
    process.env.ESPN_CFB_SCOREBOARD_URL ||
    'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=8&limit=100';
  const data = await httpGetJson(url, {
    Accept: 'application/json',
    'User-Agent': 'GatorVaultGatorsLive/1.0',
  });
  scoreboardCache = { at: Date.now(), data };
  return data;
}

async function getUfLiveBoard(options = {}) {
  const now = options.asOf ? new Date(options.asOf) : new Date();
  const force = options.force === true;
  const featured = featuredUfGame(now);
  const inWindow = isUfGameLiveWindow(now);

  if (!inWindow && !force) {
    return {
      ok: true,
      mode: 'ready',
      inWindow: false,
      featured,
      board: null,
      overlay: null,
      source: null,
    };
  }

  try {
    const scoreboard = options.scoreboard || (await fetchEspnScoreboard({ force: options.refresh === true }));
    const game = extractFloridaGame(scoreboard);
    if (!game) {
      return {
        ok: true,
        mode: 'live-window',
        inWindow: true,
        featured,
        board: null,
        overlay: null,
        source: 'espn',
        waiting: true,
      };
    }
    const status = buildStatusLine(game);
    const board = {
      ...game,
      status,
      matchup: 'Florida vs ' + game.opponent,
    };
    return {
      ok: true,
      mode: 'live-window',
      inWindow: true,
      featured,
      board,
      overlay: toBettingOverlay(game),
      source: 'espn',
    };
  } catch (err) {
    return {
      ok: false,
      mode: inWindow ? 'live-window' : 'ready',
      inWindow,
      featured,
      board: null,
      overlay: null,
      error: err.message || String(err),
    };
  }
}

function resetUfLiveScoreCache() {
  scoreboardCache = { at: 0, data: null };
}

module.exports = {
  UF_2026_GAMES,
  PREGAME_HOURS,
  POSTGAME_HOURS,
  extractFloridaGame,
  buildStatusLine,
  toBettingOverlay,
  featuredUfGame,
  isUfGameLiveWindow,
  getUfLiveBoard,
  fetchEspnScoreboard,
  resetUfLiveScoreCache,
  isInProgressState,
  isPrematchState,
};
