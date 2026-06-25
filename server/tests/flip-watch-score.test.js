const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  computeFlipWatchScore,
  flipScoreLabel,
  rivalCommitScore,
  visitRecencyScore,
} = require('../lib/flip-watch-score');

describe('flip-watch-score', () => {
  it('weights UF, visit recency, rival commit, and beat sentiment', () => {
    const result = computeFlipWatchScore(
      {
        slug: 'test-player',
        ufProbability: 38,
        committedTo: 'Texas',
        visitEnd: '2026-06-11',
      },
      { asOf: new Date('2026-06-22T12:00:00Z'), intelRows: [] }
    );
    assert.ok(result.flipScore >= 40 && result.flipScore <= 90);
    assert.equal(result.flipScoreStack.uf, 38);
    assert.equal(result.flipScoreStack.rival, 100);
    assert.ok(result.flipScoreStack.visit >= 85);
    assert.equal(result.flipScoreStack.beat, 50);
    assert.ok(['Hot', 'Warm', 'Watch', 'Low'].includes(result.flipScoreLabel));
  });

  it('flipScoreLabel maps tiers', () => {
    assert.equal(flipScoreLabel(85), 'Hot');
    assert.equal(flipScoreLabel(65), 'Warm');
    assert.equal(flipScoreLabel(45), 'Watch');
    assert.equal(flipScoreLabel(20), 'Low');
  });

  it('rivalCommitScore boosts major rivals', () => {
    assert.equal(rivalCommitScore('Texas'), 100);
    assert.equal(rivalCommitScore('Boise State'), 55);
  });

  it('visitRecencyScore decays with age', () => {
    const recent = visitRecencyScore('2026-06-15', new Date('2026-06-22'));
    const old = visitRecencyScore('2025-12-01', new Date('2026-06-22'));
    assert.ok(recent > old);
  });
});