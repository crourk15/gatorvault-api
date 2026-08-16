/**
 * Run: node --test server/test/game-week-visitors.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  expectedVisitLabelForSlug,
  mergeExpectedVisitHistory,
  buildSlugLabelMap,
} = require('../lib/game-week-visitors');

describe('game-week-visitors', () => {
  it('maps FAU and Ole Miss visitors to chase labels', () => {
    assert.equal(expectedVisitLabelForSlug('asher-ghioto'), 'Expected FAU visit · Sep 5');
    assert.equal(expectedVisitLabelForSlug('brysen-wright'), 'Expected Ole Miss visit · Sep 26');
    assert.equal(expectedVisitLabelForSlug('hudson-west'), 'Expected Ole Miss visit · Sep 26');
    assert.equal(expectedVisitLabelForSlug('not-a-real-slug'), null);
  });

  it('prepends Game Day badge with fan label', () => {
    const out = mergeExpectedVisitHistory('merrick-ham', [{ type: 'OV', label: 'OV' }]);
    assert.equal(out[0].type, 'Game Day');
    assert.equal(out[0].label, 'Expected Ole Miss visit · Sep 26');
    assert.equal(out[1].label, 'OV');
  });

  it('slug map has unique first-game wins', () => {
    const map = buildSlugLabelMap();
    assert.ok(map.size >= 20);
    assert.equal(map.get('asher-ghioto'), 'Expected FAU visit · Sep 5');
  });
});
