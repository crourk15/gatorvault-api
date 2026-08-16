/**
 * Biggest Battles RPM scale — 1% On3 must not become 100%.
 * Run: node --test server/test/battle-rpm-scale.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseUfPct, parseMarketRpmPct } = require('../lib/recruiting-hub-scoring');
const { resolveStrictUfScore, extractRealCompetitors } = require('../lib/recruiting-hub-competitors');
const { sanitizeRpmPct } = require('../lib/uf-probability-utils');

describe('parseMarketRpmPct', () => {
  it('keeps 1% as 1 and rejects residual fractions', () => {
    assert.equal(parseMarketRpmPct(1), 1);
    assert.equal(parseMarketRpmPct(1.3), 1);
    assert.equal(parseMarketRpmPct(90.5), 91);
    assert.equal(parseMarketRpmPct(0.36), null);
    assert.equal(parseMarketRpmPct(0.99), null);
  });

  it('documents why parseUfPct poisoned Biggest Battles', () => {
    assert.equal(parseUfPct(1), 100);
    assert.equal(parseUfPct(0.36), 36);
  });
});

describe('sanitizeRpmPct accepts one-percent Industry Consensus', () => {
  it('accepts 1 and rejects 0.99', () => {
    assert.equal(sanitizeRpmPct(1), 1);
    assert.equal(sanitizeRpmPct(0.99), null);
  });
});

describe('resolveStrictUfScore battle cases', () => {
  it('McCary-class: store ufRpmPct 1 stays ~1% when board says ~1%', () => {
    const player = {
      slug: 'nehemiah-mccary',
      classYear: 2028,
      ufRpmPct: 1,
      on3TopTeams: [
        { year: 2028, status: 'Offered', prediction: 90.5, team: { name: 'Alabama' } },
        { year: 2028, status: 'Offered', prediction: 1.31, team: { name: 'Florida' } },
        { year: 2028, status: 'Offered', prediction: 6.6, team: { name: 'Auburn' } },
      ],
    };
    assert.equal(resolveStrictUfScore(player, []), 1);
  });

  it('does not invent 100% from store 1 when On3 board is missing', () => {
    assert.equal(resolveStrictUfScore({ slug: 'x', ufRpmPct: 1, classYear: 2028 }, []), 1);
  });

  it('keeps real high UF RPM', () => {
    const player = {
      slug: 'cyion-smith',
      classYear: 2028,
      ufRpmPct: 97,
      on3TopTeams: [
        { year: 2028, prediction: 96.98, team: { name: 'Florida' }, status: 'Offered' },
        { year: 2028, prediction: 1.1, team: { name: 'Auburn' }, status: 'Offered' },
      ],
    };
    assert.equal(resolveStrictUfScore(player, []), 97);
  });
});

describe('competitor residuals', () => {
  it('does not turn SMU 0.36 residual into 36%', () => {
    const player = {
      slug: 'hudson-west',
      classYear: 2028,
      on3TopTeams: [
        { year: 2028, prediction: 99.3, team: { name: 'Florida' }, status: 'Offered' },
        { year: 2028, prediction: 0.36, team: { name: 'SMU' }, status: 'Offered' },
        { year: 2028, prediction: 0.05, team: { name: 'North Carolina' }, status: 'Offered' },
        { year: 2028, prediction: 0.043, team: { name: 'Kentucky' }, status: 'Offered' },
        { year: 2028, prediction: 0.043, team: { name: 'Cincinnati' }, status: 'Offered' },
        { year: 2028, prediction: 0.043, team: { name: 'Colorado' }, status: 'Offered' },
      ],
    };
    const comps = extractRealCompetitors(player, []);
    const smu = comps.find((c) => /smu/i.test(c.school));
    assert.ok(!smu || smu.score == null || smu.score < 2, JSON.stringify(smu));
  });
});
