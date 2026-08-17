/**
 * Live chase-board On3 lead regressions (Antonio / Tristian / Jamarcus / Anthony).
 * Run: npx tsx --test server/test/live-on3-lead-four.test.js
 */
const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const {
  healHighPriorityRpmPoisonRow,
  ensureHealPlayersWarm,
} = require('../api/futurecast/response-cache.ts');
const { resolveOn3LeadStamp, withOn3LeadStamp } = require('../lib/on3-lead-stamp');

describe('live On3 lead four', () => {
  before(async () => {
    await ensureHealPlayersWarm();
  });

  it('Antonio Thomas Jr stamp is UF when ufRpm missing', () => {
    const healed = withOn3LeadStamp(
      healHighPriorityRpmPoisonRow({
        slug: 'antonio-thomas-jr',
        name: 'Antonio Thomas Jr',
        stars: 4,
        ufRpmPct: null,
        competingSchools: [
          { name: 'Miami', pct: 13.4 },
          { name: 'Auburn', pct: 11.5 },
        ],
      })
    );
    assert.equal(healed.on3Lead || resolveOn3LeadStamp(healed), 'UF');
    assert.ok(Number(healed.ufRpmPct) >= 35, healed.ufRpmPct);
  });

  it('Tristian Henderson stamp is FSU (not UF from FSU% poison)', () => {
    const healed = withOn3LeadStamp(
      healHighPriorityRpmPoisonRow({
        slug: 'tristian-henderson',
        name: 'Tristian Henderson',
        stars: 4,
        ufRpmPct: 22,
        competingSchools: [
          { name: 'Georgia', pct: 19 },
          { name: 'Auburn', pct: 9 },
        ],
      })
    );
    assert.equal(healed.on3Lead || resolveOn3LeadStamp(healed), 'FSU');
    assert.ok(Number(healed.ufRpmPct) <= 12, healed.ufRpmPct);
  });

  it('Jamarcus Johnson stamp is UF when ufRpm missing', () => {
    const healed = withOn3LeadStamp(
      healHighPriorityRpmPoisonRow({
        slug: 'jamarcus-johnson',
        name: 'Jamarcus Johnson',
        stars: 4,
        ufRpmPct: null,
        competingSchools: [{ name: 'Georgia', pct: 23.2 }],
      })
    );
    assert.equal(healed.on3Lead || resolveOn3LeadStamp(healed), 'UF');
  });

  it('Anthony Howard Jr stamp is UF when ufRpm drifted to 9', () => {
    const healed = withOn3LeadStamp(
      healHighPriorityRpmPoisonRow({
        slug: 'anthony-howard-jr',
        name: 'Anthony Howard Jr',
        stars: 4,
        ufRpmPct: 9,
        competingSchools: [
          { name: 'Miami', pct: 19.7 },
          { name: 'Florida State', pct: 9.2 },
        ],
      })
    );
    assert.equal(healed.on3Lead || resolveOn3LeadStamp(healed), 'UF');
    assert.ok(Number(healed.ufRpmPct) >= 55, healed.ufRpmPct);
  });
});
