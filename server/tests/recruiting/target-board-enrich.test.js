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
  const boardRow = boardBySlug.get('asher-ghioto');
  assert.ok(boardRow, 'expected asher-ghioto on 2028 board');

  const merged = mergeBoardSeed(
    {
      slug: 'asher-ghioto',
      name: 'Asher Ghioto',
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
  const board = require('../../lib/target-board-path').loadTargetBoardBySlug(2028);
  const boardBacked = allowlist.ALLOWLIST_2028.filter((slug) => board.get(slug));
  assert.ok(boardBacked.length >= 30, 'expected board-backed allowlist targets');
  for (const slug of boardBacked) {
    assert.ok(slugs.has(slug), 'missing allowlist slug ' + slug);
  }
  assert.equal(slugs.has('brysen-wright'), false, 'Wright → Miami must not be synthesized onto the 2028 board');
});

test('enrichTargetsWithBoardSeed skips committed slugs from board synthesis', () => {
  const targets = enrichTargetsWithBoardSeed([], 2027, allowlist, {
    skipSlugs: new Set(['kamauri-whitfield']),
  });
  assert.equal(
    targets.some((p) => p.slug === 'kamauri-whitfield'),
    false,
    'committed slug must not be synthesized from target board seed'
  );
});