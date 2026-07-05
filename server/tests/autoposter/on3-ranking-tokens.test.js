/** On3 ranking token extraction — all-four-required gate. */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  extractOn3RankingTokens,
  appendRankingTokensToIdentity,
  formatRankingTokensSuffix
} = require('../../lib/autoposter/on3-ranking-tokens');

test('extractOn3RankingTokens returns null unless all four fields present', () => {
  assert.equal(extractOn3RankingTokens(null), null);
  assert.equal(extractOn3RankingTokens({ stars: 4, natlRank: 12, posRank: 3 }), null);
  assert.equal(extractOn3RankingTokens({ stars: 4, natlRank: 12, posRank: 3, stateRank: null }), null);
  assert.equal(extractOn3RankingTokens({ stars: 0, natlRank: 12, posRank: 3, stateRank: 1 }), null);
  assert.equal(extractOn3RankingTokens({ stars: 4, natlRank: 12.5, posRank: 3, stateRank: 1 }), null);
});

test('extractOn3RankingTokens accepts verified recruiting-store fields', () => {
  const tokens = extractOn3RankingTokens({
    stars: 4,
    natlRank: 42,
    posRank: 8,
    stateRank: 3
  });
  assert.deepEqual(tokens, {
    on3Stars: 4,
    on3NationalRank: 42,
    on3PositionRank: 8,
    on3StateRank: 3
  });
});

test('appendRankingTokensToIdentity adds compact suffix once', () => {
  const tokens = extractOn3RankingTokens({ stars: 4, natlRank: 42, posRank: 8, stateRank: 3 });
  const line = appendRankingTokensToIdentity('2028 EDGE Merrick Ham', tokens, 'EDGE');
  assert.match(line, /4★ · On3 No\. 42 natl · No\. 8 EDGE · No\. 3 state/);
  assert.equal(appendRankingTokensToIdentity(line, tokens, 'EDGE'), line);
});

test('appendRankingTokensToIdentity uses state abbr when provided', () => {
  const tokens = extractOn3RankingTokens({ stars: 4, natlRank: 102, posRank: 13, stateRank: 14 });
  const line = appendRankingTokensToIdentity('2028 EDGE Merrick Ham', tokens, 'EDGE', { stateAbbr: 'GA' });
  assert.match(line, /No\. 14 GA/);
});
