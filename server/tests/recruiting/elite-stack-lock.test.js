/** Tier A/B enqueue falls back to fused intel only when rankings are incomplete. */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  hasCompleteRankingTokens,
  validateEliteStack,
  ELITE_COMPOSE_PATH
} = require('../../lib/player-intelligence/elite-republish-compose');

test('hasCompleteRankingTokens requires stars natl pos state', () => {
  assert.equal(hasCompleteRankingTokens(null), false);
  assert.equal(
    hasCompleteRankingTokens({ on3Stars: 4, on3NationalRank: 42, on3PositionRank: 4, on3StateRank: 1 }),
    true
  );
  assert.equal(
    hasCompleteRankingTokens({ on3Stars: 4, on3NationalRank: null, on3PositionRank: 4, on3StateRank: 1 }),
    false
  );
});

test('validateEliteStack rejects non-elite compose paths', () => {
  const bad = validateEliteStack({
    text: 'x',
    templateBlocks: { identity: '2028 CB Test · 4★ · On3 No. 1 natl · No. 1 CB · No. 1 FL' },
    validationMeta: {
      composePath: 'pr789_beat_facts',
      rankingTokens: { on3Stars: 4, on3NationalRank: 1, on3PositionRank: 1, on3StateRank: 1 },
      pr789AngleLive: true,
      scoutingRefresh: { rankingValid: true }
    }
  });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.includes('compose_path_not_elite_pr789'));

  const good = validateEliteStack({
    text: 'x',
    templateBlocks: { identity: '2028 CB Test · 4★ · On3 No. 1 natl · No. 1 CB · No. 1 FL' },
    validationMeta: {
      composePath: ELITE_COMPOSE_PATH,
      rankingTokens: { on3Stars: 4, on3NationalRank: 1, on3PositionRank: 1, on3StateRank: 1 },
      pr789AngleLive: true,
      scoutingRefresh: { rankingValid: true }
    }
  });
  assert.equal(good.ok, true);
});
