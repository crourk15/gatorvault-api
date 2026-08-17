'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('Asher-style peer 1→100 On3-lead poison', () => {
  it('competingSchoolsFromRecruitingRecord keeps Miami lead — not OSU 100', () => {
    const { competingSchoolsFromRecruitingRecord } = require('../lib/underclassmen-intel.ts');
    const store = require('../data/recruiting/players.json');
    const rows = Array.isArray(store) ? store : store.players || [];
    const asher = rows.find((p) => p.slug === 'asher-ghioto');
    assert.ok(asher, 'asher-ghioto in store');
    const comps = competingSchoolsFromRecruitingRecord(asher);
    assert.ok(comps.length >= 1, `comps=${JSON.stringify(comps)}`);
    assert.equal(comps[0].name, 'Miami', `top=${JSON.stringify(comps[0])}`);
    assert.ok(Number(comps[0].pct) >= 60 && Number(comps[0].pct) <= 75);
    assert.ok(
      !comps.some((c) => /ohio state/i.test(c.name) && Number(c.pct) >= 90),
      `OSU must not be a fake lock: ${JSON.stringify(comps)}`
    );
  });

  it('heal strips OSU 100 when Miami owns the board on disk HP', () => {
    const { healHighPriorityRpmPoisonRow } = require('../api/futurecast/response-cache.ts');
    const healed = healHighPriorityRpmPoisonRow({
      slug: 'asher-ghioto',
      name: 'Asher Ghioto',
      ufRpmPct: 8,
      ufProbability: 15,
      competingSchools: [
        { name: 'Ohio State', pct: 100 },
        { name: 'Miami', pct: 67 },
      ],
      predictors: [{ name: 'On3 RPM', score: 8 }],
    });
    const comps = healed.competingSchools || [];
    assert.ok(comps.some((c) => /miami/i.test(c.name) && Number(c.pct) >= 60));
    assert.ok(
      !comps.some((c) => /ohio state/i.test(c.name) && Number(c.pct) >= 90),
      JSON.stringify(comps)
    );
  });
});
