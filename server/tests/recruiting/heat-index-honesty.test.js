const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

require('tsx/cjs');

describe('Recruiting Heat Index honesty', () => {
  it('does not give heat 100 to low-UF targets just because rating/fit is high', async () => {
    const { buildHubHeatIndex } = require('../../lib/recruiting-hub-elite');
    const rows = await buildHubHeatIndex(2028);
    assert.ok(Array.isArray(rows) && rows.length > 0);
    const allHundred = rows.every((r) => Number(r.heat) === 100);
    assert.equal(allHundred, false, 'heat must differentiate; rating fallback made every card 100');
    const ballard = rows.find((r) => /ballard/i.test(String(r.id || r.name || '')));
    if (ballard && ballard.ufPercent != null && Number(ballard.ufPercent) < 40) {
      assert.ok(
        Number(ballard.heat) < 80,
        `low UF lean should not show as blazing heat (got heat=${ballard.heat} uf=${ballard.ufPercent})`
      );
    }
  });
});
