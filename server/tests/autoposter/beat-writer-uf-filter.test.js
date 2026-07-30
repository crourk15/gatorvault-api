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

  it('blocks UF baseball content', () => {
    const post = {
      handle: 'corey_bender',
      writerName: 'Corey Bender',
      text: 'Florida baseball takes the series with a walk-off home run in Gainesville.',
    };
    assert.equal(beatFilters.shouldIncludeBeatPost(post), false);
    assert.equal(beatFilters.strictUfOnlyBlockReason(post, post.text), 'non_football_sport');
  });

  it('blocks UF basketball content', () => {
    const post = {
      handle: 'floridagators',
      writerName: 'Florida Gators',
      text: 'Gators basketball tips off March Madness with a win in the SEC tournament.',
    };
    assert.equal(beatFilters.shouldIncludeBeatPost(post), false);
  });

  it('allows UF football recruiting content', () => {
    const post = {
      handle: 'gatorsfb',
      writerName: 'Florida Gators Football',
      text: 'Florida football welcomes 2028 WR Easton Royal for an official visit this weekend.',
    };
    assert.equal(beatFilters.shouldIncludeBeatPost(post), true);
  });

  it('blocks national Chad Simmons Trace Hawkins post with no UF context', () => {
    const post = {
      handle: 'chadsimmons_',
      writerName: 'Chad Simmons',
      outlet: 'On3',
      text:
        'Spent time at Calhoun HS today, and a lot of eyes are on 2028 4-star QB Trace Hawkins. He helped the Yellow Jackets win a state title as a freshman in 2024, and he will announce his commitment on Thursday.',
      url: 'https://www.on3.com/rivals/trace-hawkins-247268/',
    };
    assert.equal(beatFilters.shouldIncludeBeatPost(post), false);
    assert.equal(beatFilters.strictUfOnlyBlockReason(post, post.text), 'national_missing_explicit_uf');
  });

  it('allows Chad Simmons when the post is explicitly about Florida', () => {
    const post = {
      handle: 'chadsimmons_',
      writerName: 'Chad Simmons',
      outlet: 'On3',
      text: 'Florida is pushing hard for 2028 QB Trace Hawkins after his unofficial visit to Gainesville.',
    };
    assert.equal(beatFilters.shouldIncludeBeatPost(post), true);
  });

  it('does not treat aggregator URLs as Florida-related', () => {
    assert.equal(beatFilters.isFloridaRelatedUrl('https://example.com/aggregator/feed'), false);
    assert.equal(beatFilters.isFloridaRelatedUrl('https://www.on3.com/teams/florida/news/x'), true);
  });

  it('blocks national reporter posts that only name a UF target with no Florida keywords', () => {
    const post = {
      handle: 'chadsimmons_',
      writerName: 'Chad Simmons',
      outlet: 'On3',
      text: '2028 WR Easton Royal is heating up on the trail this week.',
    };
    assert.equal(beatFilters.shouldIncludeBeatPost(post), false);
  });

  it('treats @gatorvault as brand live-feed, not recruiting ingest', () => {
    const post = {
      handle: 'gatorvault',
      writerName: 'GatorVault',
      outlet: 'GatorVault',
      text: 'VAULT TARGET: Florida is chasing 2028 TE Braxton Rein after the spring tape.',
    };
    assert.equal(beatFilters.isBrandLiveFeedAccount(post), true);
    assert.equal(beatFilters.TRUSTED_HANDLES.has('gatorvault'), true);
    assert.equal(beatFilters.BEAT_RECRUITING_INGEST_HANDLES.has('gatorvault'), false);
    assert.equal(beatFilters.shouldIncludeBeatPost(post), true);
    assert.equal(gate.isAllowedIngestAccount(post), false);
  });
});
