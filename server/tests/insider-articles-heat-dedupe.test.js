const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  heatCheckCommitsAlreadyCovered,
  articleMentionsCommitSlug,
} = require('../lib/insider-articles-engine');

const HAND_CRAFTED_PUBLISHED = {
  status: 'published',
  category: 'heat_check',
  topicKey: 'heat_check_july_cb_double_whitfield_floyd_2027',
  title: "Heat Check: Florida's July CB double — Whitfield and Floyd",
  recruitingTargets: ['Kamauri Whitfield', 'Raheem Floyd'],
};

const COMMITS = [
  { slug: 'kamauri-whitfield', name: 'Kamauri Whitfield' },
  { slug: 'raheem-floyd', name: 'Raheem Floyd' },
];

describe('heatCheckCommitsAlreadyCovered', () => {
  it('blocks engine commit topic when hand-crafted Whitfield/Floyd is already published', () => {
    assert.equal(
      heatCheckCommitsAlreadyCovered(COMMITS, [HAND_CRAFTED_PUBLISHED]),
      true
    );
  });

  it('allows a new commit story when only unrelated heat_check exists', () => {
    const other = {
      status: 'published',
      category: 'heat_check',
      topicKey: 'heat_check_commits_2026-06-01_some-other-player',
      title: 'Heat Check: Some Other locks Florida',
      coveredCommitSlugs: ['some-other-player'],
    };
    assert.equal(heatCheckCommitsAlreadyCovered(COMMITS, [other]), false);
  });

  it('blocks via coveredCommitSlugs even when title differs', () => {
    const prior = {
      status: 'draft',
      category: 'heat_check',
      topicKey: 'heat_check_commits_2026-07-07_kamauri-whitfield_raheem-floyd',
      title: 'Heat Check: Florida CB surge',
      coveredCommitSlugs: ['kamauri-whitfield', 'raheem-floyd'],
    };
    assert.equal(heatCheckCommitsAlreadyCovered(COMMITS, [prior]), true);
  });

  it('articleMentionsCommitSlug matches last-name in topicKey', () => {
    assert.equal(articleMentionsCommitSlug(HAND_CRAFTED_PUBLISHED, 'kamauri-whitfield'), true);
    assert.equal(articleMentionsCommitSlug(HAND_CRAFTED_PUBLISHED, 'raheem-floyd'), true);
    assert.equal(articleMentionsCommitSlug(HAND_CRAFTED_PUBLISHED, 'jayden-hiller'), false);
  });
});
