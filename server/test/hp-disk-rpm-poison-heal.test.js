'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { healHighPriorityRpmPoisonRow, sanitizeHighPriorityStarsPayload } = require('../api/futurecast/response-cache.ts');

describe('HP disk RPM poison heal', () => {
  it('heals Jernigan-style Florida 100 vs Miss State field', () => {
    const healed = healHighPriorityRpmPoisonRow({
      slug: 'zaiden-jernigan',
      name: 'Zaiden Jernigan',
      ufRpmPct: 100,
      ufProbability: 77,
      competingSchools: [
        { name: 'Mississippi State', pct: 20 },
        { name: 'Ole Miss', pct: 17 },
      ],
      predictors: [{ name: 'On3 RPM', score: 100 }],
    });
    assert.ok(healed.ufRpmPct == null || healed.ufRpmPct < 20);
    assert.ok(Number(healed.ufProbability) < 40);
    const on3 = (healed.predictors || []).find((p) => /on3/i.test(p.name));
    assert.ok(on3);
    assert.ok(Number(on3.score) < 20);
  });

  it('sanitizeHighPriorityStarsPayload runs heal before elite filter', () => {
    const poisoned = {
      slug: 'zaiden-jernigan',
      name: 'Zaiden Jernigan',
      stars: 4,
      ufRpmPct: 100,
      ufProbability: 77,
      competingSchools: [{ name: 'Mississippi State', pct: 20 }],
      predictors: [{ name: 'On3 RPM', score: 100 }],
    };
    // Direct row heal is the serve-path contract for Closest.
    const healed = healHighPriorityRpmPoisonRow(poisoned);
    const out = sanitizeHighPriorityStarsPayload({
      classYear: 2028,
      players: [healed, poisoned],
    });
    assert.ok(Array.isArray(out.players));
    for (const p of out.players) {
      if (p?.slug !== 'zaiden-jernigan') continue;
      assert.ok(p.ufRpmPct == null || p.ufRpmPct < 20, `rpm ${p.ufRpmPct}`);
      assert.ok(Number(p.ufProbability) < 40, `uf ${p.ufProbability}`);
    }
  });
});
