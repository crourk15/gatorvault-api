const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

require('tsx/cjs');

const { competingVolatilityBoost } = require('../../models/competing-school-history.ts');
const {
  calculateWindowVolatility,
  ROLLING_MOVEMENT_WINDOW_DAYS,
} = require('../../models/predictions.ts');

describe('competingVolatilityBoost', () => {
  it('returns 0 below threshold', () => {
    assert.equal(competingVolatilityBoost(1), 0);
    assert.equal(competingVolatilityBoost(-1), 0);
  });

  it('returns +10 when abs(delta) >= 2', () => {
    assert.equal(competingVolatilityBoost(2), 10);
    assert.equal(competingVolatilityBoost(-3), 10);
  });

  it('returns +20 when abs(delta) >= 4', () => {
    assert.equal(competingVolatilityBoost(4), 20);
    assert.equal(competingVolatilityBoost(-5), 20);
  });
});

describe('calculateWindowVolatility', () => {
  it('computes stddev over 7-day window', () => {
    const history = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-06-${String(10 + i).padStart(2, '0')}`,
      confidence: 50 + (i % 2 === 0 ? 5 : -5),
    }));
    const score = calculateWindowVolatility(history, ROLLING_MOVEMENT_WINDOW_DAYS);
    assert.ok(score > 0);
    assert.ok(score <= 100);
  });
});
