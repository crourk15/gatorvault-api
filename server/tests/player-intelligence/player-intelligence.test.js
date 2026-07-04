/** Player Intelligence layer — read API + ranking blocks. */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildAllRankingBlocks,
  selectRankingBlock,
  rankingTokensFromBlock
} = require('../../lib/player-intelligence/ranking-blocks');
const { detectGaps } = require('../../lib/player-intelligence/gaps');
const { resolveCoverageTier, isGoldenSlug } = require('../../lib/player-intelligence/tiers');

test('ranking blocks stay single-source — On3 only when complete', () => {
  const blocks = buildAllRankingBlocks({
    stars: 4,
    natlRank: 42,
    posRank: 8,
    stateRank: 3,
    on3ProfileUrl: 'https://www.on3.com/player/x'
  });
  assert.equal(blocks.on3.valid, true);
  assert.equal(blocks.rivals.valid, false);
  assert.equal(blocks.espn.valid, false);
  const selected = selectRankingBlock(blocks);
  assert.equal(selected.source, 'on3');
  assert.deepEqual(rankingTokensFromBlock(selected), {
    source: 'on3',
    on3Stars: 4,
    on3NationalRank: 42,
    on3PositionRank: 8,
    on3StateRank: 3
  });
});

test('selectRankingBlock never blends partial On3 with rivals fields', () => {
  const blocks = buildAllRankingBlocks({
    stars: 4,
    natlRank: 42,
    rivalsStars: 4,
    rivalsNatlRank: 50,
    rivalsPosRank: 9,
    rivalsStateRank: 4
  });
  assert.equal(blocks.on3.valid, false);
  assert.equal(blocks.rivals.valid, true);
  assert.equal(selectRankingBlock(blocks).source, 'rivals');
});

test('detectGaps flags incomplete rankings', () => {
  const gaps = detectGaps({
    identity: { name: 'Test Player', classYear: 2028, pos: 'S' },
    rankingBlock: { valid: false },
    rankingBlocks: { on3: { valid: false } },
    offers: [],
    visits: [],
    rpm: {}
  });
  assert.ok(gaps.includes('incomplete_rankings'));
  assert.ok(gaps.includes('no_offers'));
});

test('golden slug tier detection', () => {
  assert.equal(isGoldenSlug('ryan-drakeford'), true);
  assert.equal(isGoldenSlug('merrick-ham'), true);
  assert.equal(isGoldenSlug('random-player'), false);
});

test('resolveCoverageTier returns A for golden slug', async () => {
  const tier = await resolveCoverageTier('bryce-willingham');
  assert.equal(tier, 'A');
});
