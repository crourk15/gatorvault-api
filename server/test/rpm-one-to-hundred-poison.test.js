/**
 * Heal On3 RPM 1→100 poison (Zaiden Jernigan class).
 * Run: node --test server/test/rpm-one-to-hundred-poison.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeRpmPct, toPercent } = require('../lib/uf-probability-utils');
const {
  decideTargetingPct,
  buildStorePatchFromHydrated,
} = require('../lib/desk-intel-futurecast-feed');

describe('RPM 1% must never become 100%', () => {
  it('documents legacy toPercent poison', () => {
    assert.equal(toPercent(1), 100);
  });

  it('sanitizeRpmPct keeps 1 as one percent', () => {
    assert.equal(sanitizeRpmPct(1), 1);
    assert.equal(sanitizeRpmPct(0.99), null);
  });

  it('decideTargetingPct seeds 1% On3 as 1, not 100', () => {
    const d = decideTargetingPct({
      priorPct: null,
      on3RpmPct: 1,
      isNew: true,
      floridaOffered: true,
    });
    assert.equal(d.pct, 1);
    assert.equal(d.source, 'on3_rpm_seed');
  });

  it('buildStorePatchFromHydrated does not expand ufRpmPct 1 to 100', () => {
    const patch = buildStorePatchFromHydrated(
      {
        name: 'Zaiden Jernigan',
        classYear: 2028,
        ufRpmPct: 1,
        ufProbability: null,
        school: 'Louisville (MS)',
      },
      'zaiden-jernigan',
      null
    );
    assert.equal(patch.ufRpmPct, 1);
    assert.notEqual(patch.ufRpmPct, 100);
  });
});
