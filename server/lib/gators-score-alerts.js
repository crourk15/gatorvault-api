/**
 * UF game-window score alerts - kickoff + final only.
 * Polls ESPN scoreboard only inside pregame/postgame windows from the 2026 schedule.
 */
const fs = require('fs');
const path = require('path');
const { dispatchScorePush } = require('./push-alert-service');
const { parseEasternKickoff } = require('./eastern-kickoff');
const {
  extractFloridaGame,
  fetchEspnScoreboard,
  isInProgressState,
  isPrematchState,
  isUfGameLiveWindow,
  UF_2026_GAMES,
} = require('./uf-live-score');

function resolveStatePath() {
  const fromEnv = String(process.env.GV_OPS_DATA_DIR || process.env.GV_LIVE_DATA_DIR || '').trim();
  if (fromEnv) {
    return path.join(fromEnv, 'gators-score-alert-state.json');
  }
  return path.join(__dirname, '../data/ops/gators-score-alert-state.json');
}

const STATE_PATH = resolveStatePath();

function parseScheduleKickoff(dateStr) {
  return parseEasternKickoff(dateStr);
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

function isInProgress(state) {
  return isInProgressState(state);
}

function isPrematch(state) {
  return isPrematchState(state);
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
