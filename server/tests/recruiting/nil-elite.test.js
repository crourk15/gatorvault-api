const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildNilEliteBundle, formatNilEstimate } = require('../../lib/nil-elite');

describe('nil-elite', () => {
  it('formatNilEstimate ignores empty/zero', () => {
    assert.equal(formatNilEstimate({ nilValue: 0 }), null);
    assert.equal(formatNilEstimate({ nilValue: 906000 }), '$906K');
  });

  it('builds board with real commits and targets', async () => {
    const b = await buildNilEliteBundle();
    assert.equal(b.ok, true);
    assert.ok(b.pulse.commits >= 20);
    assert.ok(b.marketBoard.targets.length > 0);
    assert.ok(b.collectives.some((c) => c.isUf && /Victorious/i.test(c.collective || '')));
    assert.ok(b.portal.rosterArrivals.length > 0);
    for (const p of b.marketBoard.targets.slice(0, 5)) {
      assert.equal(p.nilEstimate, null);
    }
  });
});
