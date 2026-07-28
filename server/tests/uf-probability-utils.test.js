'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveGatorVaultLikelihood,
  sanitizeRpmPct,
  canExposeWeekDelta,
} = require('../lib/uf-probability-utils');

describe('resolveGatorVaultLikelihood market anchor', () => {
  it('keeps Cobbins-style elite Fit from inventing commit odds above On3', () => {
    const resolved = resolveGatorVaultLikelihood({
      rpmPct: 7,
      fitScore: 94,
    });
    assert.ok(resolved.value <= 18, `expected <=18 got ${resolved.value}`);
    assert.ok(resolved.value >= 5, `expected >=5 got ${resolved.value}`);
    assert.equal(resolved.rpmAnchor, 7);
    assert.ok(resolved.inputs.includes('fit'));
    assert.ok(resolved.inputs.includes('on3_rpm'));
  });

  it('lets Fit nudge when UF is already competitive on On3', () => {
    const flat = resolveGatorVaultLikelihood({
      rpmPct: 60,
      fitScore: 50,
    });
    const elite = resolveGatorVaultLikelihood({
      rpmPct: 60,
      fitScore: 90,
    });
    assert.ok(elite.value >= flat.value, 'elite fit should not lower odds vs neutral');
    assert.ok(elite.value <= 78, `should stay near market, got ${elite.value}`);
    assert.ok(Math.abs(elite.value - 60) <= 18);
  });

  it('Matthews-style high RPM stays near market without Fit', () => {
    const resolved = resolveGatorVaultLikelihood({
      rpmPct: 60,
      fitScore: 0,
    });
    assert.equal(resolved.value, 60);
  });

  it('Drakeford-style low RPM + high Fit stays market-honest', () => {
    const resolved = resolveGatorVaultLikelihood({
      rpmPct: 5,
      fitScore: 86,
    });
    assert.ok(resolved.value <= 16, `expected <=16 got ${resolved.value}`);
  });
});

describe('odds trust guards', () => {
  it('sanitizeRpmPct rejects residual fractions', () => {
    assert.equal(sanitizeRpmPct(0.6887), null);
    assert.equal(sanitizeRpmPct(15), 15);
  });

  it('canExposeWeekDelta blocks thin +72', () => {
    assert.equal(canExposeWeekDelta({ delta: 72, lowConfidence: true }), false);
  });
});
