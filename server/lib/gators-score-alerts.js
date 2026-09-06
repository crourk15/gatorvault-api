/**
 * UF game-window score alerts — kickoff, every score, halftime, final.
 * Polls ESPN inside the 2026 schedule window. Deduped per event + scoreline.
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

function shortOpponent(name) {
  const raw = String(name || 'Opponent').trim();
  if (/florida atlantic|fau/i.test(raw)) return 'FAU';
  const first = raw.split(/\s+/)[0];
  return first || raw;
}

function periodLabel(period) {
  const n = Number(period);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  if (n === 4) return '4th';
  return `OT${n - 4 === 1 ? '' : n - 4}`;
}

function clockBit(game) {
  const q = periodLabel(game.period);
  const clock = String(game.clock || '').trim();
  if (q && clock) return `${q} ${clock}`;
  if (game.detail && !/final/i.test(game.detail)) return String(game.detail).trim();
  return q || '';
}

function isHalftime(game) {
  const blob = `${game.state || ''} ${game.detail || ''}`.toLowerCase();
  return /half/.test(blob);
}

function classifyScoreDelta(ufDelta, oppDelta, opponent) {
  const opp = shortOpponent(opponent);
  if (ufDelta > 0 && oppDelta <= 0) {
    if (ufDelta === 1) return null;
    if (ufDelta === 3) return { title: 'Gators field goal', kind: 'score' };
    if (ufDelta === 2) return { title: 'Gators safety', kind: 'score' };
    if (ufDelta >= 6) return { title: 'Gators touchdown', kind: 'score' };
    return { title: 'Gators score', kind: 'score' };
  }
  if (oppDelta > 0 && ufDelta <= 0) {
    if (oppDelta === 1) return null;
    if (oppDelta === 3) return { title: `${opp} field goal`, kind: 'score' };
    if (oppDelta === 2) return { title: `${opp} scores`, kind: 'score' };
    if (oppDelta >= 6) return { title: `${opp} touchdown`, kind: 'score' };
    return { title: `${opp} scores`, kind: 'score' };
  }
  if (ufDelta > 0 && oppDelta > 0) return { title: 'Score update', kind: 'score' };
  return null;
}

function scoreLine(game) {
  const opp = shortOpponent(game.opponent);
  return `Florida ${game.ufScore} · ${opp} ${game.oppScore}`;
}

/** Pure: which lock-screen beats fire for this ESPN snapshot vs last state. */
function planScoreAlerts(game, prev = {}) {
  const planned = [];
  if (!game || !game.eventId) return planned;

  const becameLive =
    !prev.kickoffSent && (isInProgress(game.state) || (game.ufScore != null && !isPrematch(game.state)));
  if (becameLive) {
    planned.push({
      kind: 'kickoff',
      title: 'Gators kickoff',
      opponent: game.opponent,
      detail: game.detail || `Florida vs ${shortOpponent(game.opponent)} is underway.`,
      fingerprint: `score_kickoff|${game.eventId}`,
    });
  }

  const becameFinal = !prev.finalSent && (game.completed || /final/i.test(game.state || ''));
  const prevUf = prev.lastScores && Number.isFinite(Number(prev.lastScores.uf)) ? Number(prev.lastScores.uf) : null;
  const prevOpp = prev.lastScores && Number.isFinite(Number(prev.lastScores.opp)) ? Number(prev.lastScores.opp) : null;
  const hasScores = Number.isFinite(Number(game.ufScore)) && Number.isFinite(Number(game.oppScore));
  const scoreKey = hasScores ? `${game.ufScore}-${game.oppScore}` : '';
  const alreadyAlertedScore = Boolean(scoreKey) && prev.lastScoreAlert === scoreKey;
  const nonzero = hasScores && (Number(game.ufScore) > 0 || Number(game.oppScore) > 0);

  if (!becameFinal && nonzero && !alreadyAlertedScore) {
    const ufDelta = Number(game.ufScore) - (prevUf == null ? 0 : prevUf);
    const oppDelta = Number(game.oppScore) - (prevOpp == null ? 0 : prevOpp);
    const classified = classifyScoreDelta(ufDelta, oppDelta, game.opponent);
    if (classified) {
      const clock = clockBit(game);
      planned.push({
        kind: 'score',
        title: classified.title,
        opponent: game.opponent,
        ufScore: game.ufScore,
        oppScore: game.oppScore,
        detail: clock ? `${scoreLine(game)} · ${clock}` : scoreLine(game),
        fingerprint: `score_update|${game.eventId}|${scoreKey}`,
      });
    }
  }

  if (!prev.halftimeSent && isHalftime(game) && !becameFinal) {
    planned.push({
      kind: 'halftime',
      title: 'Halftime',
      opponent: game.opponent,
      ufScore: game.ufScore,
      oppScore: game.oppScore,
      detail: hasScores ? `Halftime · ${scoreLine(game)}` : `Halftime · Florida vs ${shortOpponent(game.opponent)}`,
      fingerprint: `score_halftime|${game.eventId}`,
    });
  }

  if (becameFinal) {
    planned.push({
      kind: 'final',
      title: 'Final',
      opponent: game.opponent,
      ufScore: game.ufScore,
      oppScore: game.oppScore,
      detail: hasScores
        ? `Final · ${scoreLine(game)}`
        : `Florida vs ${shortOpponent(game.opponent)} is final.`,
      fingerprint: `score_final|${game.eventId}`,
    });
  }

  return planned;
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

  const game = options.game || extractFloridaGame(scoreboard);
  if (!game || !game.eventId) {
    return { ok: true, skipped: true, reason: 'florida_not_on_scoreboard' };
  }

  const stateDoc = options.stateDoc || readState();
  stateDoc.games = stateDoc.games || {};
  const prev = stateDoc.games[game.eventId] || {};
  const results = [];

  let planned = planScoreAlerts(game, prev);
  if (force && options.kind) {
    planned = planned.filter((p) => p.kind === options.kind);
    if (!planned.length) {
      const forcedPrev = {
        ...prev,
        kickoffSent: options.kind === 'kickoff' ? false : true,
        halftimeSent: options.kind === 'halftime' ? false : true,
        finalSent: options.kind === 'final' ? false : true,
        lastScores: options.kind === 'score' ? { uf: 0, opp: 0 } : prev.lastScores,
      };
      planned = planScoreAlerts(game, forcedPrev).filter((p) => p.kind === options.kind);
    }
  }

  for (const beat of planned) {
    if (force && options.kind && beat.kind !== options.kind) continue;
    const push = await dispatchScorePush(
      {
        kind: beat.kind,
        title: beat.title,
        opponent: beat.opponent,
        ufScore: beat.ufScore,
        oppScore: beat.oppScore,
        detail: beat.detail,
      },
      {
        dryRun,
        fingerprint: beat.fingerprint,
      }
    );
    results.push({ kind: beat.kind, title: beat.title, push });
    if (!dryRun && push.ok && !push.skipped) {
      if (beat.kind === 'kickoff') {
        prev.kickoffSent = true;
        prev.kickoffAt = new Date().toISOString();
      } else if (beat.kind === 'halftime') {
        prev.halftimeSent = true;
        prev.halftimeAt = new Date().toISOString();
      } else if (beat.kind === 'final') {
        prev.finalSent = true;
        prev.finalAt = new Date().toISOString();
      } else if (beat.kind === 'score') {
        prev.lastScoreAlert = `${beat.ufScore}-${beat.oppScore}`;
        prev.lastScoreAlertAt = new Date().toISOString();
      }
    }
  }

  stateDoc.games[game.eventId] = {
    ...prev,
    opponent: game.opponent,
    lastState: game.state,
    lastScores: { uf: game.ufScore, opp: game.oppScore },
    updatedAt: new Date().toISOString(),
  };
  if (!dryRun && !options.stateDoc) writeState(stateDoc);

  return {
    ok: true,
    eventId: game.eventId,
    opponent: game.opponent,
    results,
    dryRun,
  };
}

function startScoreAlertWatch() {
  if (startScoreAlertWatch._started) return;
  startScoreAlertWatch._started = true;
  const intervalMs = Math.max(
    30000,
    parseInt(process.env.GATORS_SCORE_ALERTS_WATCH_MS || '60000', 10) || 60000
  );
  const tick = () => {
    runGatorsScoreAlerts().catch((err) => {
      console.warn('[gators-score-alerts] watch failed:', err.message || err);
    });
  };
  setTimeout(tick, Math.min(15000, intervalMs));
  setInterval(tick, intervalMs);
  console.log('[gators-score-alerts] in-game watch every', Math.round(intervalMs / 1000), 's (idle outside UF windows)');
}

module.exports = {
  runGatorsScoreAlerts,
  planScoreAlerts,
  classifyScoreDelta,
  startScoreAlertWatch,
  isUfGameLiveWindow,
  parseScheduleKickoff,
  extractFloridaGame,
  UF_2026_GAMES,
  STATE_PATH,
};
