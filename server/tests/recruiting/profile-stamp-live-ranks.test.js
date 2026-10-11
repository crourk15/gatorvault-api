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

  it('replaces a stamped Texas pledge once Easton Royal is a Florida commit', () => {
    const stamp = {
      player: { fullName: 'Easton Royal', committedTo: 'Florida', slug: 'easton-royal' },
      highSchoolProfile: {
        recruitingNotes: '5★ WR committed to Texas — Closing Class Flip Watch #2.',
        stats: {},
      },
      signals: [
        {
          signalType: 'EVALUATION_NOTE',
          signalValue: {
            note: '5★ WR committed to Texas — Closing Class Flip Watch #2.',
            source: 'recruiting-store',
          },
        },
      ],
    };
    const out = overlayLiveRpm(stamp, {
      committedTo: 'Florida',
      profileNote:
        'Flipped from Texas to Florida on October 11, 2026. Hayes Fawcett, Rivals. No. 1 wide receiver in the 2027 class.',
    });
    assert.equal(out.player.committedTo, 'Florida');
    assert.match(out.highSchoolProfile.recruitingNotes, /Flipped from Texas to Florida/);
    assert.doesNotMatch(out.highSchoolProfile.recruitingNotes, /committed to Texas/i);
    assert.match(out.signals[0].signalValue.note, /Flipped from Texas to Florida/);
    assert.doesNotMatch(out.signals[0].signalValue.note, /committed to Texas/i);
  });

  it('replaces a stamped IMG Academy school with Brother Martin for Easton Royal', () => {
    const out = overlayLiveRpm(
      {
        player: {
          slug: 'easton-royal',
          committedTo: 'Florida',
          highSchool: 'IMG Academy (Bradenton, FL)',
          hometown: 'New Orleans',
          state: 'FL',
        },
        highSchoolProfile: {
          recruitingNotes: 'Flipped from Texas to Florida on October 11, 2026.',
        },
      },
      {
        committedTo: 'Florida',
        verifiedCommit: true,
        school: 'Brother Martin',
        hometownCity: 'New Orleans',
        hometownState: 'LA',
      }
    );
    assert.equal(out.player.highSchool, 'Brother Martin');
    assert.equal(out.player.hometown, 'New Orleans');
    assert.equal(out.player.state, 'LA');
    assert.equal(out.player.committedTo, 'Florida');
  });

  it('leaves a real non-Florida pledge note alone', () => {
    const stamp = {
      player: { fullName: 'Jalen Brewster', committedTo: 'Texas Tech' },
      highSchoolProfile: {
        recruitingNotes: '5★ DT committed to Texas Tech — Closing Class Flip Watch #1.',
      },
    };
    const out = overlayLiveRpm(stamp, { committedTo: 'Texas Tech', ufRpmPct: 4 });
    assert.match(out.highSchoolProfile.recruitingNotes, /committed to Texas Tech/i);
  });
});
