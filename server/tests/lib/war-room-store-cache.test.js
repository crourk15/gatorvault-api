'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const wr = require('../../lib/war-room-store');

describe('war-room-store hot-path cache', () => {
  it('getBreakdownBySlug returns live comps after repeated reads', () => {
    const a = wr.getBreakdownBySlug('maxwell-hiller');
    const b = wr.getBreakdownBySlug('maxwell-hiller');
    assert.ok(a && a.comparison);
    assert.equal(a.comparison, b.comparison);
  });

  it('getAllBreakdowns resolves without per-slug disk thrash', () => {
    const t0 = Date.now();
    const all = wr.getAllBreakdowns();
    const elapsed = Date.now() - t0;
    assert.ok(Array.isArray(all) && all.length > 50, 'expected many breakdowns');
    assert.ok(elapsed < 2500, 'getAllBreakdowns too slow: ' + elapsed + 'ms');
    const hiller = all.find((e) => e.playerSlug === 'maxwell-hiller');
    assert.ok(hiller && hiller.comparison);
  });
});
