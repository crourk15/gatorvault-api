/**
 * System fix: beat fact extractors must unlock PR-789 for offer/visit-interest beats
 * (Dawson "offering him", Fleming "another trip to Gainesville").
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { extractBeatFacts } = require('../../../lib/autoposter/rewrite/beat-fact-extractor');
const { hasFactCompletenessForPr789 } = require('../../../lib/autoposter/rewrite/fact-gates');

const DAWSON_BEAT =
  'Florida recently entered the recruitment of 2028 Mount Vernon (Ohio) tight end Landon Dawson when offering him after a strong performance at camp.';

const FLEMING_BEAT =
  '"100 percent." That was Joey Fleming\'s answer when asked if another trip to Gainesville could happen soon. The nation\'s No. 1 interior OL details his strong interest in the Gators and more...';

describe('beat fact system gaps', () => {
  it('Dawson-style offering language sets offerInterest and passes PR-789', () => {
    const facts = extractBeatFacts(DAWSON_BEAT, {
      player: { name: 'Landon Dawson', classYear: 2028, pos: 'TE' },
    });
    assert.equal(facts.offerInterest, true);
    assert.equal(hasFactCompletenessForPr789(facts, DAWSON_BEAT), true);
  });

  it('Fleming-style return-trip interest sets visit.when and passes PR-789', () => {
    const facts = extractBeatFacts(FLEMING_BEAT, {
      player: { name: 'Joey Fleming', classYear: 2028, pos: 'IOL' },
    });
    assert.equal(facts.visit?.school, 'Florida');
    assert.ok(facts.visit?.when);
    assert.match(String(facts.visit.when), /gainesville/i);
    assert.equal(facts.offerInterest, true);
    assert.equal(hasFactCompletenessForPr789(facts, FLEMING_BEAT), true);
  });
});
