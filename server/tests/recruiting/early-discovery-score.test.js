const test = require('node:test');
const assert = require('node:assert/strict');
const { computeDiscoveryScore, clamp100 } = require('../../lib/early-discovery-score.js');

test('computeDiscoveryScore boosts stars and Florida geo', () => {
  const base = computeDiscoveryScore({ signalTypes: [], stars: 3, rating: null, inFlorida: false });
  const flFive = computeDiscoveryScore({
    signalTypes: ['STAFF_FLAG', 'CAMP_PERFORMANCE'],
    stars: 5,
    rating: 0.92,
    inFlorida: true,
  });
  assert.ok(base >= 28 && base <= 50);
  assert.ok(flFive > base);
  assert.equal(clamp100(150), 100);
});

test('computeDiscoveryScore aggregates signal weights with cap', () => {
  const heavy = computeDiscoveryScore({
    signalTypes: ['STAFF_FLAG', 'PORTAL_ACTIVITY', 'CAMP_PERFORMANCE', 'RANKING_JUMP'],
    stars: 4,
    rating: 0.88,
    inFlorida: true,
  });
  assert.ok(heavy >= 70 && heavy <= 100);
});