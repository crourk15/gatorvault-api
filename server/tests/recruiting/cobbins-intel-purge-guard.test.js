const test = require('node:test');
const assert = require('node:assert/strict');
const prefilter = require('../../lib/beat-intel-prefilter');

const cobbinsIntel = {
  playerName: 'Jermaine Cobbins',
  playerSlug: 'jermaine-cobbins',
  detail:
    "The Florida Gators' defensive back history and coaching staff continue standing out to one of the country's top 2028 prospects.",
  source: 'auto:on3-team-news',
  identityConfirmed: true,
  articleUrl:
    'https://www.on3.com/teams/florida-gators/news/how-florida-is-off-to-a-fast-start-with-elite-cb-jermaine-cobbins/'
};

test('confirmed On3 team-news intel survives purge eligibility gate', async () => {
  assert.equal(prefilter.shouldSurfaceRecruitingIntelSync(cobbinsIntel), true);
  assert.equal(await prefilter.shouldSurfaceRecruitingIntel(cobbinsIntel), true);
});
