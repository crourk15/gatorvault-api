const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { overlayLiveRpm } = require('../../lib/player-profile-stamp');

describe('profile stamp live Industry ranks', () => {
  it('overlays recruiting store ranks onto stale stamp player + hs stats', () => {
    const stamp = {
      player: {
        fullName: 'Brysen Wright',
        rankingNational: 208,
        rankingPosition: 2,
        rankingState: 1,
        compositeRating: 97.77,
        stars: 5,
      },
      highSchoolProfile: {
        stats: { natlRank: 208, posRank: 2, stateRank: 1, rating: 97.77, stars: 5 },
      },
    };
    const out = overlayLiveRpm(stamp, {
      natlRank: 1,
      posRank: 1,
      stateRank: 1,
      rating: 98.028,
      stars: 5,
      ufRpmPct: 17,
    });
    assert.equal(out.player.rankingNational, 1);
    assert.equal(out.player.rankingPosition, 1);
    assert.equal(out.player.rankingState, 1);
    assert.equal(out.player.compositeRating, 98.028);
    assert.equal(out.highSchoolProfile.stats.natlRank, 1);
    assert.equal(out.highSchoolProfile.stats.posRank, 1);
    assert.equal(out.ranksLive, true);
    assert.equal(out.player.ufRpmPct, 17);
  });
});
