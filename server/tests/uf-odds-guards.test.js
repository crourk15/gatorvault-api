/**
 * Trust guards for Florida odds — residual scale + Discovery Movement.
 * Run: node --test server/tests/uf-odds-guards.test.js server/test/on3-rpm-scale.test.js
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  sanitizeRpmPct,
  sanitizeStoreOddsPct,
  toPercent,
  canExposeWeekDelta,
  resolveGatorVaultLikelihood,
  temperExtremeUncommittedRpm,
  resolveUncommittedMarketRpm,
  MAX_WEEK_DELTA_HARD,
} = require('../lib/uf-probability-utils');
const {
  ufRpmFromTopTeams,
  detectTopTeamsPctScale,
  normalizePredictionToPct,
} = require('../lib/on3-board-hydrate');

function petersonLikeBoard() {
  const residual = 0.6887052341597797;
  return [
    { team: { name: 'Georgia' }, status: 'Offered', prediction: 17.63058399490326, year: 2028 },
    { team: { name: 'Florida' }, status: 'Offered', prediction: 15.426992754171906, year: 2028 },
    { team: { name: 'Alabama' }, status: 'Offered', prediction: 13.232141049586769, year: 2028 },
    { team: { name: 'Florida State' }, status: 'Offered', prediction: 0.7555555555555556, year: 2028 },
    { team: { name: 'Ohio State' }, status: 'Offered', prediction: 0.41321314049858678, year: 2028 },
    { team: { name: 'Penn State' }, status: 'Offered', prediction: residual, year: 2028 },
    { team: { name: 'Notre Dame' }, status: 'Offered', prediction: residual, year: 2028 },
    { team: { name: 'SMU' }, status: 'Offered', prediction: residual, year: 2028 },
    { team: { name: 'Ole Miss' }, status: 'Offered', prediction: residual, year: 2028 },
    { team: { name: 'Auburn' }, status: 'Offered', prediction: residual, year: 2028 },
  ];
}

/** Percent-scale board where Florida is only a residual micro (0.99). */
function cyionPoisonBoard() {
  const residual = 0.99;
  return [
    { team: { name: 'Georgia' }, status: 'Offered', prediction: 42.1, year: 2028 },
    { team: { name: 'Alabama' }, status: 'Offered', prediction: 28.4, year: 2028 },
    { team: { name: 'Florida' }, status: 'Offered', prediction: residual, year: 2028 },
    { team: { name: 'Penn State' }, status: 'Offered', prediction: residual, year: 2028 },
    { team: { name: 'Notre Dame' }, status: 'Offered', prediction: residual, year: 2028 },
    { team: { name: 'SMU' }, status: 'Offered', prediction: residual, year: 2028 },
  ];
}

describe('Florida odds sanitizers', () => {
  it('never expands residual unit-interval into 69%/99% RPM', () => {
    assert.equal(sanitizeRpmPct(0.6887), null);
    assert.equal(sanitizeRpmPct(0.99), null);
    assert.equal(sanitizeRpmPct(15.4), 15);
    assert.equal(sanitizeRpmPct(99), 99);
  });

  it('rejects extreme store unit-interval without strong RPM', () => {
    assert.equal(sanitizeStoreOddsPct(0.99), null);
    assert.equal(sanitizeStoreOddsPct(0.24), 24);
    assert.equal(sanitizeStoreOddsPct(0.92, { rpmPct: 88 }), 92);
  });

  it('toPercent still supports honest store fractions', () => {
    assert.equal(toPercent(0.24), 24);
    assert.equal(toPercent(15.4), 15);
  });

  it('Cyion-shaped thin rebuild stays ~15–30, never 99', () => {
    const resolved = resolveGatorVaultLikelihood({
      storePct: 0.99, // residual leak
      rpmPct: 0.99,
      fitScore: 0,
      stars: 4,
    });
    assert.ok(resolved.value < 40, `got ${resolved.value}`);
    assert.notEqual(resolved.value, 99);
  });

  it('copies corroborated 95%+ On3 so Lab Florida chance matches the industry lock', () => {
    assert.equal(temperExtremeUncommittedRpm(97), 64);
    assert.equal(temperExtremeUncommittedRpm(95), 58);
    assert.equal(temperExtremeUncommittedRpm(75), 75);

    const vickersTeams = [
      { team: { name: 'Florida' }, status: 'Offered', prediction: 95.74, year: 2028 },
      { team: { name: 'Clemson' }, status: 'Offered', prediction: 1.39, year: 2028 },
      { team: { name: 'Georgia Tech' }, status: 'Offered', prediction: 0.65, year: 2028 },
    ];
    const locked = resolveUncommittedMarketRpm({
      rpmPct: 96,
      committed: false,
      topTeams: vickersTeams,
      classYear: 2028,
    });
    assert.equal(locked, 96);

    const resolved = resolveGatorVaultLikelihood({
      rpmPct: locked,
      fitScore: 73,
    });
    assert.ok(resolved.value >= 84, `got ${resolved.value}`);
    assert.ok(resolved.value <= 99, `got ${resolved.value}`);
  });

  it('crumb On3 RPM cannot crush a real staff store lean', () => {
    const resolved = resolveGatorVaultLikelihood({
      rpmPct: 1,
      storePct: 72,
      fitScore: 55,
    });
    assert.ok(resolved.value >= 50, `Taylor-style staff lean crushed to ${resolved.value}`);
    assert.ok(resolved.value < 90, `got ${resolved.value}`);
  });

  it('missing topTeams still tempers 95%+ (prod Cyion rows) — never copies 99', () => {
    assert.equal(
      resolveUncommittedMarketRpm({
        rpmPct: 97,
        committed: false,
        topTeams: [],
        classYear: 2028,
      }),
      64
    );
    const tempered99 = resolveUncommittedMarketRpm({
      rpmPct: 99,
      committed: false,
      topTeams: cyionPoisonBoard(),
      classYear: 2028,
    });
    assert.equal(tempered99, 69);
    const resolved = resolveGatorVaultLikelihood({
      rpmPct: tempered99,
      fitScore: 50,
    });
    assert.ok(resolved.value < 85, `must not copy 99 into GV, got ${resolved.value}`);
    assert.notEqual(resolved.value, 99);
  });

  it('suppresses +72 thin fireworks', () => {
    assert.equal(
      canExposeWeekDelta({ delta: 72, rpmPct: null, lowConfidence: true }),
      false
    );
    assert.equal(
      canExposeWeekDelta({ delta: 72, rpmPct: 15, lowConfidence: false }),
      false
    );
    assert.ok(MAX_WEEK_DELTA_HARD < 72);
    assert.equal(
      canExposeWeekDelta({ delta: 8, rpmPct: 40, lowConfidence: false }),
      true
    );
  });
});

describe('On3 hydrate residual guards', () => {
  it('Peterson board keeps Florida ~15%, never residual 69', () => {
    assert.equal(detectTopTeamsPctScale(petersonLikeBoard()), 'percent');
    assert.equal(normalizePredictionToPct(0.6887052341597797, 'percent') < 1, true);
    const uf = ufRpmFromTopTeams(petersonLikeBoard(), 2028);
    assert.ok(uf > 15 && uf < 16, String(uf));
  });

  it('Florida-only residual 0.99 on percent board → null RPM (not 99)', () => {
    const uf = ufRpmFromTopTeams(cyionPoisonBoard(), 2028);
    assert.equal(uf, null);
  });
});
