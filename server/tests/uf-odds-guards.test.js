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
