const test = require('node:test');
const assert = require('node:assert/strict');
const {
  enrichBoard,
  dedupeBoardPlayers,
  dropTargetsAlreadyCommitted,
  assignTier,
} = require('../../lib/recruiting-board-enrich');

function assertNoDuplicateNames(players) {
  const names = players.map((p) => String(p.name || '').trim().toLowerCase()).filter(Boolean);
  assert.equal(new Set(names).size, names.length, `duplicate names: ${names.join(', ')}`);
}

test('enrichBoard drops stale target when player is already committed', () => {
  const board = {
    classYear: 2027,
    commits: [
      {
        slug: 'kamauri-whitfield',
        name: 'Kamauri Whitfield',
        pos: 'CB',
        classYear: 2027,
        stars: 3,
        rating: 87.1,
        committedTo: 'Florida',
        commitDate: '2026-07-06',
      },
    ],
    targets: [
      {
        slug: 'kamauri-whitfield',
        name: 'Kamauri Whitfield',
        pos: 'ATH',
        classYear: 2027,
        stars: 4,
        state: 'GA',
        school: 'Douglas County, GA',
      },
    ],
  };

  const result = enrichBoard(board);
  assertNoDuplicateNames(result.players);

  const whitfield = result.players.filter((p) => p.slug === 'kamauri-whitfield');
  assert.equal(whitfield.length, 1);
  assert.equal(whitfield[0].isCommittedToUF, true);
  assert.equal(result.targets.some((p) => p.slug === 'kamauri-whitfield'), false);
});

test('dedupeBoardPlayers prefers commit over target for same name', () => {
  const deduped = dedupeBoardPlayers([
    { name: 'Kamauri Whitfield', slug: 'kamauri-whitfield', isCommittedToUF: true },
    { name: 'Kamauri Whitfield', slug: 'kamauri-whitfield', isCommittedToUF: false },
  ]);

  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].isCommittedToUF, true);
});

test('dropTargetsAlreadyCommitted matches slug or normalized name', () => {
  const commits = [{ slug: 'player-a', name: 'Player A', isCommittedToUF: true }];
  const targets = [
    { slug: 'player-a', name: 'Player A', isCommittedToUF: false },
    { slug: 'player-b', name: 'Player B', isCommittedToUF: false },
  ];

  const kept = dropTargetsAlreadyCommitted(commits, targets);
  assert.deepEqual(kept.map((p) => p.slug), ['player-b']);
});

test('assignTier treats 0-100 ratings as percent scale (not fractional)', () => {
  assert.equal(assignTier({ rating: 92, stars: 4 }), 'HIGH');
  assert.equal(assignTier({ rating: 98.5, stars: 5 }), 'TOP');
  assert.equal(assignTier({ rating: 0.92, stars: 4 }), 'HIGH');
  assert.equal(assignTier({ rating: 0.985, stars: 5 }), 'TOP');
});