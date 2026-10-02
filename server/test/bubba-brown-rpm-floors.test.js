/**
 * Bubba Brown Chad Simmons Florida RPM — floors heal stale Georgia board.
 * Run: npx --test server/test/bubba-brown-rpm-floors.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  healHighPriorityRpmPoisonRow,
  mergeHealBoardTruth,
  __testPrimeHealTruth,
} = require('../api/futurecast/response-cache.ts');
const { resolveOn3LeadStamp, withOn3LeadStamp } = require('../lib/on3-lead-stamp');

const STALE = {
  slug: 'bubba-brown',
  name: 'Bubba Brown',
  stars: 4,
  ufRpmPct: 19,
  ufProbability: 33,
  competingSchools: [
    { name: 'Georgia', pct: 40.3 },
    { name: 'Auburn', pct: 16.5 },
  ],
};

describe('bubba brown florida rpm floors', () => {
  it('merges floor Florida 98 over durable Georgia 40 / UF 19', () => {
    const merged = mergeHealBoardTruth(
      {
        storeRpm: 19,
        boardRpm: 19,
        storeComps: [
          { name: 'Georgia', pct: 40.3 },
          { name: 'Auburn', pct: 16.5 },
        ],
      },
      {
        storeRpm: 98,
        boardRpm: 98,
        storeComps: [{ name: 'Georgia', pct: 1 }],
      }
    );
    assert.ok(merged);
    assert.equal(merged.boardRpm, 98);
    assert.equal(merged.storeRpm, 98);
    assert.equal(merged.storeComps[0]?.name, 'Georgia');
    assert.ok(Number(merged.storeComps[0]?.pct) < 10, JSON.stringify(merged.storeComps));
  });

  it('heals live HP row to UF after Simmons Florida RPM', () => {
    const healed = withOn3LeadStamp(healHighPriorityRpmPoisonRow({ ...STALE }));
    assert.equal(healed.on3Lead || resolveOn3LeadStamp(healed), 'UF');
    assert.ok(Number(healed.ufRpmPct) >= 90, healed.ufRpmPct);
    const uga = (healed.competingSchools || []).find((c) => /georgia/i.test(String(c.name)));
    assert.ok(!uga || Number(uga.pct) < 10, JSON.stringify(healed.competingSchools));
  });

  it('still stamps UF when warm players.json is the August Georgia board', () => {
    __testPrimeHealTruth('bubba-brown', {
      storeRpm: 19,
      boardRpm: 19,
      storeComps: [
        { name: 'Georgia', pct: 40.3 },
        { name: 'Auburn', pct: 16.5 },
      ],
    });
    try {
      const healed = withOn3LeadStamp(healHighPriorityRpmPoisonRow({ ...STALE }));
      assert.equal(healed.on3Lead || resolveOn3LeadStamp(healed), 'UF');
      assert.ok(Number(healed.ufRpmPct) >= 90, healed.ufRpmPct);
    } finally {
      __testPrimeHealTruth('bubba-brown', null);
    }
  });
});
