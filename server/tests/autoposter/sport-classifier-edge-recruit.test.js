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

  it('blocks hoops recruiting that looks like a 5-star / commit beat', () => {
    const daughtry =
      'NEW: 5-star PG Cayden Daughtry broke down all four official visits with @JoeTipton — and he is down to Florida.';
    const condon =
      '4-star PF Ian Condon commits to the Florida Gators UF has their first commitment in the class.';
    assert.equal(classifySport(daughtry).sport, 'basketball');
    assert.equal(isFootballAutoposterEligible(daughtry), false);
    assert.equal(classifySport(condon).sport, 'basketball');
    assert.equal(isFootballAutoposterEligible(condon), false);
  });

  it('still treats football 4-star OT / CB commits as football', () => {
    const bailey = '4-star Samuel Bailey is a Gator. Now the real work begins for Florida’s offensive line.';
    const floyd = 'Florida is headed to Missouri this weekend, and 4-star CB commit Raheem Floyd will be there.';
    assert.equal(classifySport(bailey).sport, 'football');
    assert.equal(classifySport(floyd).sport, 'football');
  });

  it('still blocks UF baseball', () => {
    const text = 'Florida baseball takes the series with a walk-off home run in Gainesville.';
    assert.equal(classifySport(text, { handle: 'corey_bender' }).sport, 'baseball');
    assert.equal(isFootballAutoposterEligible(text, { handle: 'corey_bender' }), false);
  });
});
