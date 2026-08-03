/**
 * On3 pageProps visits live at profile.visits.visits with dateOccurred seconds.
 * Run: node server/test/on3-visit-extract.test.js
 */
const assert = require('assert');
const { profilePatchFromOn3 } = require('../lib/allowlist-target-sync');

function main() {
  const profile = {
    name: 'Cyion Smith',
    stars: 4,
    topTeams: [
      {
        year: 2028,
        status: 'Offered',
        prediction: 97,
        team: { name: 'Florida', fullName: 'Florida Gators', abbreviation: 'UF' },
        coaches: [{ type: 'primary', name: 'Chris Collins' }],
        officialVisitCount: 0,
        unOfficialVisitCount: 2,
      },
    ],
    visits: {
      visits: [
        {
          organization: { name: 'Florida', fullName: 'Florida Gators' },
          visitType: 'Unofficial',
          dateOccurred: 1781913600,
        },
        {
          organization: { name: 'Florida', fullName: 'Florida Gators' },
          visitType: 'Unofficial',
          dateOccurred: 1780444800,
        },
      ],
      organizationCounts: [],
    },
    rankingsPlayer: {},
  };
  const patch = profilePatchFromOn3(profile, 2028);
  const fl = (patch.visits || []).filter((v) => /^florida$/i.test(v.school));
  assert.strictEqual(fl.length, 2);
  assert.ok(fl.every((v) => v.date && /^\d{4}-\d{2}-\d{2}$/.test(v.date)));
  assert.strictEqual(patch.ufRpmPct, 97);
  console.log('on3-visit-extract.test.js: PASS');
}
main();
