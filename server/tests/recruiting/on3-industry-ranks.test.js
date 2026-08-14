const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { pickOn3IndustryRanks } = require('../../lib/on3-recruit-client');
const { applyEditorialPositionToPlayer } = require('../../lib/recruiting-editorial-positions');

describe('On3 Industry rank picker', () => {
  it('uses consensusOverallRank as Industry national, not Rivals overallRank', () => {
    const ranks = pickOn3IndustryRanks({
      consensusOverallRank: 1,
      overallRank: 3,
      consensusPositionRank: 1,
      positionRank: 2,
      consensusStateRank: 1,
      stateRank: 1,
      consensusRating: 98.03,
      consensusStars: 5,
    });
    assert.equal(ranks.natlRank, 1);
    assert.equal(ranks.posRank, 1);
    assert.equal(ranks.stateRank, 1);
    assert.equal(ranks.rating, 98.03);
    assert.equal(ranks.stars, 5);
  });

  it('does not fall back to single-service ranks', () => {
    const ranks = pickOn3IndustryRanks({
      overallRank: 3,
      positionRank: 2,
      stateRank: 1,
      rating: 98,
    });
    assert.equal(ranks.natlRank, null);
    assert.equal(ranks.posRank, null);
    assert.equal(ranks.stateRank, null);
  });
});

describe('editorial board rank fill', () => {
  it('does not clobber live On3 ranks with stale board seed', () => {
    const out = applyEditorialPositionToPlayer({
      slug: 'brysen-wright',
      classYear: 2028,
      pos: 'WR',
      natlRank: 1,
      posRank: 1,
      stateRank: 1,
      rating: 98.03,
      stars: 5,
    });
    assert.equal(out.natlRank, 1);
    assert.equal(out.posRank, 1);
    assert.equal(out.rating, 98.03);
  });
});
