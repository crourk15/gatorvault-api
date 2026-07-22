/**
 * UF game-window score alerts - kickoff + final only.
 * Polls ESPN scoreboard only inside pregame/postgame windows from the 2026 schedule.
 */
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { dispatchScorePush } = require('./push-alert-service');

function resolveStatePath() {
  const fromEnv = String(process.env.GV_OPS_DATA_DIR || process.env.GV_LIVE_DATA_DIR || '').trim();
  if (fromEnv) {
    return path.join(fromEnv, 'gators-score-alert-state.json');
  }
  return path.join(__dirname, '../data/ops/gators-score-alert-state.json');
}

const STATE_PATH = resolveStatePath();
const PREGAME_HOURS = 3;
const POSTGAME_HOURS = 5;
const FLORIDA_TEAM_ID = '57';

/** Keep in sync with client/lib/schedule-data.ts (kickoff strings). */
const UF_2026_GAMES = [
  { opp: 'FAU Owls', date: 'September 5, 2026 7:45 PM ET' },
  { opp: 'Campbell Camels', date: 'September 12, 2026 5:30 PM ET' },
  { opp: 'Auburn Tigers', date: 'September 19, 2026 7:00 PM ET' },
  { opp: 'Ole Miss Rebels', date: 'September 26, 2026 TBA' },
  { opp: 'Missouri Tigers', date: 'October 3, 2026 TBA' },
  { opp: 'South Carolina Gamecocks', date: 'October 10, 2026 TBA' },
  { opp: 'Texas Longhorns', date: 'October 17, 2026 TBA' },
  { opp: 'Georgia Bulldogs', date: 'October 31, 2026 3:30 PM ET' },
  { opp: 'Kentucky Wildcats', date: 'November 14, 2026 TBA' },
  { opp: 'Vanderbilt Commodores', date: 'November 21, 2026 TBA' },
  { opp: 'Florida State Seminoles', date: 'November 27, 2026 TBA' },
];

function parseScheduleKickoff(dateStr) {
  const cleaned = String(dateStr || '')
    .replace(/\s*[|]\s*/g, ' ')
    .replace(/\s*ET\s*$/i, '')
    .trim();
  if (!cleaned || /TBA/i.test(cleaned)) return null;
  const d = new Date(cleaned);
  return Number.isFinite(d.getTime()) ? d : null;
}

function isUfGameLiveWindow(now = new Date()) {
  const t = now.getTime();
  for (const g of UF_2026_GAMES) {
    const kick = parseScheduleKickoff(g.date);
    if (!kick) continue;
    const start = kick.getTime() - PREGAME_HOURS * 3600_000;
    const end = kick.getTime() + POSTGAME_HOURS * 3600_000;
    if (t >= start && t <= end) return true;
  }
  return false;
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return { version: 1, games: {} };
  }
}

function writeState(doc) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  doc.updatedAt = new Date().toISOString();
  fs.writeFileSync(STATE_PATH, JSON.stringify(doc, null, 2));
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
      const status = comp.status?.type || {};
      return {
        eventId: String(event.id || comp.id || ''),
        opponent: opponent?.team?.displayName || opponent?.team?.shortDisplayName || 'Opponent',
        ufScore: florida.score != null ? Number(florida.score) : null,
        oppScore: opponent?.score != null ? Number(opponent.score) : null,
        state: String(status.name || status.state || '').toLowerCase(),
        completed: Boolean(status.completed),
        detail: status.detail || status.shortDetail || '',
      };
    }
  }
  return null;
}

async function fetchEspnScoreboard() {
  const url =
    process.env.ESPN_CFB_SCOREBOARD_URL ||
    'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=8&limit=100';
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'GatorVaultScoreAlerts/1.0' },
    timeout: 20_000,
  });
  if (!res.ok) throw new Error(`espn_scoreboard_${res.status}`);
  return res.json();
}

function isInProgress(state) {
  return /in|live|halftime|end.?period|end.?half/i.test(state || '');
}

function isPrematch(state) {
  return /pre|sched|status_scheduled/i.test(state || '') || !state;
}

async function runGatorsScoreAlerts(options = {}) {
  const now = options.asOf ? new Date(options.asOf) : new Date();
  const force = options.force === true;
  const dryRun = options.dryRun === true;

  if (!force && !isUfGameLiveWindow(now)) {
    return { ok: true, skipped: true, reason: 'outside_uf_game_window' };
  }

  let scoreboard;
  try {
    scoreboard = await fetchEspnScoreboard();
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }

  const game = extractFloridaGame(scoreboard);
  if (!game || !game.eventId) {
    return { ok: true, skipped: true, reason: 'florida_not_on_scoreboard' };
  }

  const stateDoc = readState();
  stateDoc.games = stateDoc.games || {};
  const prev = stateDoc.games[game.eventId] || {};
  const results = [];

  const becameLive =
    !prev.kickoffSent && (isInProgress(game.state) || (game.ufScore != null && !isPrematch(game.state)));
  if (becameLive || (force && options.kind === 'kickoff')) {
    const push = await dispatchScorePush(
      {
        kind: 'kickoff',
        opponent: game.opponent,
        detail: game.detail || `Florida vs ${game.opponent} is underway.`,
      },
      {
        dryRun,
        fingerprint: `score_kickoff|${game.eventId}`,
      }
    );
    results.push({ kind: 'kickoff', push });
    if (!dryRun && push.ok && !push.skipped) {
      prev.kickoffSent = true;
      prev.kickoffAt = new Date().toISOString();
    }
  }

  const becameFinal = !prev.finalSent && (game.completed || /final/i.test(game.state));
  if (becameFinal || (force && options.kind === 'final')) {
    const push = await dispatchScorePush(
      {
        kind: 'final',
        opponent: game.opponent,
        ufScore: game.ufScore,
        oppScore: game.oppScore,
        detail:
          game.ufScore != null && game.oppScore != null
            ? `Final: Florida ${game.ufScore} - ${game.opponent} ${game.oppScore}`
            : `Florida vs ${game.opponent} is final.`,
      },
      {
        dryRun,
        fingerprint: `score_final|${game.eventId}`,
      }
    );
    results.push({ kind: 'final', push });
    if (!dryRun && push.ok && !push.skipped) {
      prev.finalSent = true;
      prev.finalAt = new Date().toISOString();
    }
  }

  stateDoc.games[game.eventId] = {
    ...prev,
    opponent: game.opponent,
    lastState: game.state,
    lastScores: { uf: game.ufScore, opp: game.oppScore },
    updatedAt: new Date().toISOString(),
  };
  if (!dryRun) writeState(stateDoc);

  return {
    ok: true,
    eventId: game.eventId,
    opponent: game.opponent,
    results,
    dryRun,
  };
}

module.exports = {
  runGatorsScoreAlerts,
  isUfGameLiveWindow,
  parseScheduleKickoff,
  extractFloridaGame,
  UF_2026_GAMES,
  STATE_PATH,
};
