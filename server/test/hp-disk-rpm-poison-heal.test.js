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

describe('HP disk board rehydrate', () => {
  it('heals Girton-style empty comps + locked Florida RPM from store topTeams', async () => {
    const { ensureHealPlayersWarm } = require('../api/futurecast/response-cache.ts');
    await ensureHealPlayersWarm();
    const healed = healHighPriorityRpmPoisonRow({
      slug: 'denairo-girton-jr',
      name: 'DeNairo Girton Jr',
      ufRpmPct: 96,
      ufProbability: 71,
      competingSchools: [],
      predictors: [{ name: 'On3 RPM', score: 96 }],
    });
    const comps = healed.competingSchools || [];
    assert.ok(comps.length >= 1, 'should rehydrate peer board');
    assert.ok(comps.some((c) => /penn state/i.test(c.name)), `comps=${JSON.stringify(comps)}`);
    assert.ok(Number(healed.ufRpmPct) < 20, `rpm=${healed.ufRpmPct}`);
    assert.ok(Number(healed.ufProbability) < 35, `uf=${healed.ufProbability}`);
  });

  it('heals Gabriel Field 80 / GV 85 when Miami owns ~94% (0.80 crumb poison)', () => {
    const healed = healHighPriorityRpmPoisonRow({
      slug: 'gabriel-player',
      name: 'Gabriel Player',
      ufRpmPct: 80,
      ufProbability: 85,
      competingSchools: [
        { name: 'Miami', pct: 94 },
        { name: 'Ohio State', pct: 1 },
      ],
      predictors: [{ name: 'On3 RPM', score: 80 }],
    });
    assert.ok(Number(healed.ufRpmPct) <= 5, `Field rpm=${healed.ufRpmPct}`);
    assert.ok(Number(healed.ufProbability) < 30, `GV=${healed.ufProbability}`);
    const on3 = (healed.predictors || []).find((p) => /on3/i.test(p.name));
    assert.ok(on3);
    assert.ok(Number(on3.score) <= 5, `On3 predictor=${on3.score}`);
  });

  it('does not sync-parse players.json on clear-rival request path', () => {
    // Gabriel-shaped row must heal from in-row Miami 94 without needing store warm.
    const healed = healHighPriorityRpmPoisonRow({
      slug: 'synthetic-rival-lock',
      name: 'Synthetic Rival',
      ufRpmPct: 80,
      ufProbability: 85,
      competingSchools: [{ name: 'Miami', pct: 94 }],
      predictors: [{ name: 'On3 RPM', score: 80 }],
    });
    assert.ok(Number(healed.ufRpmPct) <= 10, `rpm=${healed.ufRpmPct}`);
    assert.ok(Number(healed.ufProbability) < 30, `uf=${healed.ufProbability}`);
  });
});
