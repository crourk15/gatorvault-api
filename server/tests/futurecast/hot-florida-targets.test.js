const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  computeHotTargetScore,
  scorePositionalNeed,
  scoreGeoPipeline,
  scoreMustGetFit,
  normalizeStaffHeat,
  scoreMarketPressure,
} = require('../../lib/hot-florida-targets');

describe('Hottest Florida Targets composite', () => {
  it('weights trenches / pass rush as higher positional need than RB', () => {
    assert.ok(scorePositionalNeed({ pos: 'EDGE' }) > scorePositionalNeed({ pos: 'RB' }));
    assert.ok(scorePositionalNeed({ pos: 'OT' }) > scorePositionalNeed({ pos: 'WR' }));
  });

  it('gives Florida in-state a geo pipeline edge without using visit count', () => {
    const fl = scoreGeoPipeline({ inState: true, state: 'FL', stars: 4 });
    const out = scoreGeoPipeline({ inState: false, state: 'AL', stars: 4 });
    assert.ok(fl > out);
  });

  it('scores physical + IQ into must-get fit', () => {
    const fit = scoreMustGetFit(
      { pos: 'EDGE', htWt: '6-4 / 230', stars: 4, rating: 92, natlRank: 40 },
      { strengths: ['rare frame', 'high football IQ', 'leadership'] },
      { traits: ['twitch', 'bend', 'field vision'] }
    );
    assert.ok(fit >= 50, `expected strong fit, got ${fit}`);
  });

  it('ranks staff-hot need fit above local UV logistics alone', () => {
    const emptyIndex = {
      bySlug: new Map([
        ['hot-edge', { ov: 0, uv: 1, home: 1, flOffers: 1, latestVisitAt: 0, latestHomeVisitAt: 0, pursuitHits: 1 }],
        ['uv-local', { ov: 0, uv: 4, home: 0, flOffers: 1, latestVisitAt: 0, latestHomeVisitAt: 0, pursuitHits: 0 }],
      ]),
      allowlisted: new Set(['hot-edge', 'uv-local']),
      staffMap: {
        'hot-edge': { staff_lead_id: 'harris', secondary_recruiter_id: 'chris-prescott' },
      },
      headliners: new Set(),
      intelCounts: new Map([['hot-edge', 2]]),
      intelFamilies: new Map([['hot-edge', new Set(['beat', 'offer'])]]),
      pursuitCounts: new Map([['hot-edge', 1]]),
      scheduledOvSlugs: new Set(),
      days: 180,
    };
    const hot = computeHotTargetScore(
      {
        slug: 'hot-edge',
        pos: 'EDGE',
        stars: 4,
        rating: 91,
        htWt: '6-4 / 235',
        inState: true,
        state: 'FL',
        delta7d: 6,
      },
      {
        chaseIndex: emptyIndex,
        warRoom: { strengths: ['length', 'twitch', 'football IQ'] },
        film: { traits: ['bend', 'burst'] },
        delta7d: 6,
      }
    );
    const local = computeHotTargetScore(
      {
        slug: 'uv-local',
        pos: 'RB',
        stars: 3,
        rating: 82,
        inState: true,
        state: 'FL',
        delta7d: 0,
      },
      { chaseIndex: emptyIndex, warRoom: null, film: null, delta7d: 0 }
    );
    assert.ok(
      hot.hotScore > local.hotScore,
      `hot EDGE (${hot.hotScore}) should beat UV-local RB (${local.hotScore})`
    );
    assert.equal(hot.badges.homeVisit, true);
    assert.ok(normalizeStaffHeat(hot.chaseScore) >= hot.lanes.staffHeat - 1);
  });
});

  it('treats high UF RPM as market pressure even when delta7d is flat', () => {
    assert.equal(scoreMarketPressure(0, null), 0);
    assert.ok(scoreMarketPressure(0, 97) >= 90, '97% RPM should lock market pressure');
    assert.ok(scoreMarketPressure(0, 97) > scoreMarketPressure(0, 20));
    assert.ok(scoreMarketPressure(6, 10) >= 55, 'delta still counts');
  });
