/**
 * Remaining-season score / win-chance from official UF scoring form.
 *
 * The old board was a weekly hand-stamp (Missouri 28-21) that never moved
 * when Florida started putting up 50+ a week. This overlays remaining games
 * from actual finals: use season PPG, regress so we do not put 50 on every
 * SEC card, and never flip Texas / Georgia to a UF win off G5/FCS tape.
 */
'use strict';

const PRED_MODEL = 'uf-form-v1';

/** Opponent look — not Vegas. Elite stays UF underdog even on 50-ppg form. */
const OPP_LOOK = {
  missouri: { short: 'Missouri', tier: 'plus', oppPts: 24 },
  scar: { short: 'South Carolina', tier: 'sec', oppPts: 21 },
  texas: { short: 'Texas', tier: 'elite', oppPts: 34 },
  uga: { short: 'Georgia', tier: 'elite', oppPts: 32 },
  oklahoma: { short: 'Oklahoma', tier: 'plus', oppPts: 27 },
  kentucky: { short: 'Kentucky', tier: 'sec', oppPts: 23 },
  vandy: { short: 'Vanderbilt', tier: 'sec', oppPts: 22 },
  fsu: { short: 'FSU', tier: 'plus', oppPts: 24 },
};

/** Share of form-blended pace that lands on the card. */
const TIER_SHARE = {
  elite: 0.58,
  plus: 0.78,
  sec: 0.76,
};

const SEC_BASELINE = 31;
const FORM_WEIGHT = 0.72;
const MIN_FINALS = 3;

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function isBye(game) {
  return String(game?.kind || '') === 'bye' || /^bye/i.test(String(game?.id || ''));
}

function isFinal(game) {
  return Number.isFinite(Number(game?.finalUF)) && Number.isFinite(Number(game?.finalOpp));
}

function mean(nums) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function measureUfScoringForm(games) {
  const done = (Array.isArray(games) ? games : []).filter((g) => !isBye(g) && isFinal(g));
  return {
    n: done.length,
    ufPpg: mean(done.map((g) => Number(g.finalUF))),
    allowed: mean(done.map((g) => Number(g.finalOpp))),
  };
}

function venueKind(game) {
  const v = String(game?.venue || '');
  if (/gainesville/i.test(v)) return 'home';
  if (/mercedes|atlanta/i.test(v)) return 'neutral';
  return 'road';
}

function venueFactor(kind) {
  if (kind === 'home') return 1;
  if (kind === 'neutral') return 0.94;
  return 0.91;
}

/** Blend this year's PPG with a 31-pt SEC baseline — not 50 every Saturday. */
function blendedUfPace(ufPpg) {
  const n = Number(ufPpg);
  if (!Number.isFinite(n) || n <= 0) return SEC_BASELINE;
  return FORM_WEIGHT * n + (1 - FORM_WEIGHT) * SEC_BASELINE;
}

function footballScore(n) {
  return Math.max(10, Math.round(n));
}

function ufPctFromMargin(margin) {
  return clamp(50 + 2.1 * margin, 22, 86);
}

function projectRemainingGame(game, form) {
  const look = OPP_LOOK[String(game?.id || '')];
  if (!look || !form || form.n < MIN_FINALS) return null;
  const pace = blendedUfPace(form.ufPpg);
  let predUF = footballScore(pace * TIER_SHARE[look.tier] * venueFactor(venueKind(game)));
  let predOpp = footballScore(look.oppPts);
  if (look.tier === 'elite' && predUF >= predOpp) predOpp = predUF + 6;
  const ufPct = ufPctFromMargin(predUF - predOpp);
  return {
    predUF,
    predOpp,
    pred: `UF ${predUF} \u00b7 ${look.short} ${predOpp}`,
    ufPct,
  };
}

function applyFormPredictions(doc) {
  if (!doc || !Array.isArray(doc.games)) return doc;
  const form = measureUfScoringForm(doc.games);
  if (form.n < MIN_FINALS || !Number.isFinite(form.ufPpg)) return doc;
  let changed = false;
  const games = doc.games.map((game) => {
    if (!game || isBye(game) || isFinal(game)) return game;
    const next = projectRemainingGame(game, form);
    if (!next) return game;
    if (game.predUF === next.predUF && game.predOpp === next.predOpp && game.ufPct === next.ufPct) {
      return game;
    }
    const delta = next.ufPct - Number(game.ufPct || 0);
    changed = true;
    return {
      ...game,
      predUF: next.predUF,
      predOpp: next.predOpp,
      pred: next.pred,
      ufPct: next.ufPct,
      predConfidence: clamp(68 + Math.abs(next.predUF - next.predOpp), 60, 84),
      predMovement: delta > 1 ? 'up' : delta < -1 ? 'down' : game.predMovement || 'flat',
      ufPctDelta: Math.round(delta),
    };
  });
  if (!changed) return doc;
  return {
    ...doc,
    games,
    predThrough: '2026-W7',
    predModel: PRED_MODEL,
  };
}

module.exports = {
  PRED_MODEL,
  OPP_LOOK,
  measureUfScoringForm,
  blendedUfPace,
  venueKind,
  projectRemainingGame,
  applyFormPredictions,
};
