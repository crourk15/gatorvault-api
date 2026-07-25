const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildHubFootprint } = require('../../lib/recruiting-hub-intel-store');

describe('Footprint pin geo honesty', () => {
  it('does not park non-FL targets on the Florida centroid', async () => {
    const fp = await buildHubFootprint(2028);
    const fl = { lat: 27.766279, lng: -81.686783 };
    const bad = (fp.pins || []).filter(
      (p) =>
        p.state &&
        p.state !== 'FL' &&
        Math.abs(Number(p.lat) - fl.lat) < 0.05 &&
        Math.abs(Number(p.lng) - fl.lng) < 0.05
    );
    assert.equal(
      bad.length,
      0,
      `out-of-state pins on FL centroid: ${bad.map((p) => p.name + ':' + p.state).join(', ')}`
    );
  });
});
