const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const beatFilters = require('../../lib/beat-writer-filters');
const gate = require('../../lib/beat-recruiting-ingest-gate');

const EJ_HOLLAND = {
  handle: 'ejhollandon3',
  writerName: 'EJ Holland',
  outlet: 'On3',
};

describe('beat-writer UF-only filter', () => {
  it('blocks Miami-only tweet from EJ Holland', () => {
    const post = {
      ...EJ_HOLLAND,
      text: 'Miami adds another piece to its 2027 class with a commitment from four-star CB Marcus Lee.',
    };
    assert.equal(beatFilters.shouldIncludeBeatPost(post), false);
    assert.equal(beatFilters.passesStrictUfOnlyFilter(post, post.text), false);
    assert.equal(gate.evaluateStrictRecruitingIngestGate(post, post.text).pass, false);
  });

  it('allows EJ Holland tweet with Florida context', () => {
    const post = {
      ...EJ_HOLLAND,
      text: '2028 WR Easton Royal will take an official visit to Florida from June 11–13.',
    };
    assert.equal(beatFilters.shouldIncludeBeatPost(post), true);
    assert.equal(gate.evaluateStrictRecruitingIngestGate(post, post.text).pass, true);
  });

  it('allows UF target name without explicit Florida mention', () => {
    const post = {
      handle: 'corey_bender',
      writerName: 'Corey Bender',
      text: '2028 WR Easton Royal is set for an official visit this weekend.',
    };
    assert.equal(beatFilters.passesStrictUfOnlyFilter(post, post.text), true);
  });

  it('blocks other-program mention without UF context', () => {
    const post = {
      handle: 'corey_bender',
      writerName: 'Corey Bender',
      text: '2027 QB John Smith committed to Alabama today.',
    };
    assert.equal(beatFilters.shouldIncludeBeatPost(post), false);
    assert.equal(beatFilters.mentionsOtherProgramWithoutUf(post.text), true);
  });

  it('allows competing-school tweet when Florida is also mentioned', () => {
    const post = {
      handle: 'corey_bender',
      writerName: 'Corey Bender',
      text: 'Florida and Miami are battling for 2028 WR Easton Royal after his OV in Gainesville.',
    };
    assert.equal(beatFilters.shouldIncludeBeatPost(post), true);
  });

  it('allows UF mention inside quotes with rival program in same tweet', () => {
    const post = {
      handle: 'corey_bender',
      writerName: 'Corey Bender',
      text: 'Georgia is pushing hard, but "Florida is very much in the mix" for 2028 WR Hudson West.',
    };
    assert.equal(beatFilters.passesStrictUfOnlyFilter(post, post.text), true);
    assert.equal(beatFilters.mentionsOtherProgramWithoutUf(post.text, post), false);
  });

  it('blocks rival-program reporter without UF context', () => {
    const post = {
      handle: 'stateoftheu',
      writerName: 'State of the U',
      text: '2027 WR John Smith picks up a Miami offer after camp.',
    };
    assert.equal(beatFilters.isOtherProgramReporter(post), true);
    assert.equal(beatFilters.shouldIncludeBeatPost(post), false);
  });
});
