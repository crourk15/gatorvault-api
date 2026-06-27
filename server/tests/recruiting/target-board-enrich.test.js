const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  enrichTargetsWithBoardSeed,
  mergeBoardSeed,
  toUfFraction,
} = require('../../lib/target-board-enrich');
const allowlist = require('../../lib/recruiting-target-allowlist');

test('toUfFraction accepts percent and fraction', () => {
  assert.equal(toUfFraction(47), 0.47);
  assert.equal(toUfFraction(0.29), 0.29);
  assert.equal(toUfFraction(0), null);
});

test('mergeBoardSeed fills ranks and UF from 2028 target board', () => {
  const boardBySlug = require('../../lib/target-board-path').loadTargetBoardBySlug(2028, path.join(__dirname, '../..'));
  const boardRow = boardBySlug.get('brysen-wright');
  assert.ok(boardRow, 'expected brysen-wright on 2028 board');

  const merged = mergeBoardSeed(
    {
      slug: 'brysen-wright',
      name: 'Brysen Wright',
      classYear: 2028,
      category: 'target',
      natlRank: null,
    },
    boardRow,
    2028
  );

  assert.equal(merged.natlRank, boardRow.natlRank);
  assert.ok(merged.ufProbability > 0 && merged.ufProbability <= 1);
});

test('enrichTargetsWithBoardSeed backfills allowlist rows from board seed', () => {
  const targets = enrichTargetsWithBoardSeed(
    [
      {
        slug: 'bryce-willingham',
        name: 'Bryce Willingham',
        classYear: 2028,
        category: 'target',
        stars: 4,
      },
    ],
    2028,
    allowlist
  );

  const slugs = new Set(targets.map((p) => p.slug));
  assert.ok(slugs.has('bryce-willingham'));
  assert.ok(slugs.size >= allowlist.ALLOWLIST_2028.length);
  for (const slug of allowlist.ALLOWLIST_2028) {
    assert.ok(slugs.has(slug), 'missing allowlist slug ' + slug);
  }
});