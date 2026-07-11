/**
 * System fix: allowlist On3 patch must persist RPM / offers / visits / slug
 * (same intel golden-four already wrote).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { profilePatchFromOn3 } = require('../../lib/allowlist-target-sync');

describe('profilePatchFromOn3 intel fields', () => {
  const profile = {
    name: 'Test Recruit',
    pos: 'LB',
    classYear: 2028,
    stars: 4,
    slug: 'test-recruit-999001',
    school: 'Example HS',
    state: 'FL',
    rankingsPlayer: {
      consensusStars: 4,
      consensusOverallRank: 100,
      consensusPositionRank: 10,
      consensusStateRank: 5,
      consensusRating: 92.1,
    },
    topTeams: [
      {
        year: 2028,
        status: 'Offer',
        percent: 12,
        prediction: 12,
        team: { name: 'Florida', fullName: 'Florida Gators' },
      },
      {
        year: 2028,
        status: 'Offer',
        percent: 40,
        team: { name: 'Georgia', fullName: 'Georgia Bulldogs' },
      },
      {
        year: 2028,
        status: 'Interested',
        percent: 20,
        team: { name: 'Alabama', fullName: 'Alabama Crimson Tide' },
      },
    ],
    visits: [
      {
        official: false,
        date: '2025-10-04',
        organization: { name: 'Florida', fullName: 'Florida Gators' },
      },
    ],
  };

  it('persists ufRpmPct, topTeams, offers, visits, on3Slug/url', () => {
    const patch = profilePatchFromOn3(profile, 2028);
    assert.equal(patch.ufRpmPct, 12);
    assert.ok(Array.isArray(patch.on3TopTeams) && patch.on3TopTeams.length >= 2);
    assert.equal(patch.on3Slug, 'test-recruit-999001');
    assert.match(String(patch.on3ProfileUrl || ''), /test-recruit-999001/);
    assert.ok(Array.isArray(patch.offers) && patch.offers.length >= 2);
    assert.ok(patch.offers.some((o) => /florida/i.test(o.school)));
    assert.ok(patch.offers.some((o) => /georgia/i.test(o.school)));
    assert.ok(Array.isArray(patch.visits) && patch.visits.length >= 1);
    assert.ok(/florida/i.test(patch.visits[0].school));
  });
});
