const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  classifySport,
  isFootballAutoposterEligible
} = require('../../lib/x-autoposter-sport-classifier');
const beatFilters = require('../../lib/beat-writer-filters');
const gate = require('../../lib/beat-recruiting-ingest-gate');

describe('sport classifier - EDGE / visit soft recruiting (Bender path)', () => {
  it('treats EDGE + Florida visit copy as football', () => {
    const text = '2028 EDGE Merrick Ham will visit Florida';
    const c = classifySport(text, { handle: 'corey_bender' });
    assert.equal(c.sport, 'football');
    assert.equal(isFootballAutoposterEligible(text, { handle: 'corey_bender' }), true);
  });

  it('treats visited / offered verb forms with UF context as football', () => {
    const text =
      'The pass rusher visited Gainesville in early March where Florida extended an offer to Merrick Ham.';
    const c = classifySport(text, { handle: 'corey_bender' });
    assert.equal(c.sport, 'football');
    assert.equal(isFootballAutoposterEligible(text, { handle: 'corey_bender' }), true);
  });

  it('allows Corey Bender Merrick Ham body copy through UF football gate', () => {
    const text =
      'Florida continues to turn up the heat on 2028 prospects, and one of the defensive targets the Gators identified early is Marietta (Ga.) EDGE Merrick Ham. The 6-foot-6, 235-pound pass rusher visited Gainesville in early March where Florida extended an offer.';
    const post = {
      handle: 'corey_bender',
      writerName: 'Corey Bender',
      text,
      url: 'https://www.on3.com/teams/florida/news/gators-trending-merrick-ham'
    };
    assert.equal(classifySport(text, post).sport, 'football');
    assert.equal(beatFilters.shouldIncludeBeatPost(post), true);
    assert.equal(gate.evaluateStrictRecruitingIngestGate(post, text).pass, true);
  });

  it('still blocks UF baseball', () => {
    const text = 'Florida baseball takes the series with a walk-off home run in Gainesville.';
    assert.equal(classifySport(text, { handle: 'corey_bender' }).sport, 'baseball');
    assert.equal(isFootballAutoposterEligible(text, { handle: 'corey_bender' }), false);
  });
});
