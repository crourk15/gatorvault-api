/** Golden four On3 sync — verified recruit slugs + ranking status cache. */
const test = require('node:test');
const assert = require('node:assert/strict');

const golden = require('../../lib/player-intelligence/golden-four-on3');

test('golden four maps production slugs to verified On3 recruit slugs', () => {
  assert.equal(golden.on3RecruitSlugFor('merrick-ham'), 'merrick-ham-281179');
  assert.equal(golden.on3RecruitSlugFor('ryan-drakeford'), 'ryan-drakeford-242808');
  assert.equal(golden.on3RecruitSlugFor('man-robinson'), 'man-robinson-260972');
  assert.equal(golden.on3RecruitSlugFor('bryce-willingham'), 'bryce-willingham-261593');
});

test('isGoldenFourRankingComplete reflects cache', () => {
  golden.setGoldenFourRankingCompleteForTests(false);
  assert.equal(golden.isGoldenFourRankingComplete(), false);
  golden.setGoldenFourRankingCompleteForTests(true);
  assert.equal(golden.isGoldenFourRankingComplete(), true);
});

test('shouldUsePr789AngleLive requires golden four ranking complete', () => {
  const { shouldUsePr789AngleLive } = require('../../lib/autoposter/rewrite/golden-beats');
  golden.setGoldenFourRankingCompleteForTests(false);
  assert.equal(
    shouldUsePr789AngleLive({ playerSlug: 'merrick-ham' }, { ok: true, rewrittenTweet: 'x' }),
    false
  );
  golden.setGoldenFourRankingCompleteForTests(true);
  process.env.X_AUTOPOST_PR7_8_9_ENABLED = 'true';
  process.env.X_AUTOPOST_PR789_ANGLE_GOLDEN_LIVE = 'true';
  assert.equal(
    shouldUsePr789AngleLive({ playerSlug: 'merrick-ham' }, { ok: true, rewrittenTweet: 'x' }),
    true
  );
});
