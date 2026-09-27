'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  stripVerifiedUfCommitsFromRows,
  stripVerifiedUfCommitsFromHubPayload,
} = require('../../lib/recruiting-verified-commits');
const { buildBattleBoardRows } = require('../../lib/recruiting-hub-data');

test('stripVerifiedUfCommitsFromRows drops Cyion from chase plates', () => {
  const rows = [
    { slug: 'cyion-smith', name: 'Cyion Smith' },
    { id: 'hudson-west', name: 'Hudson West' },
  ];
  const next = stripVerifiedUfCommitsFromRows(rows);
  assert.deepEqual(next.map((row) => row.slug || row.id), ['hudson-west']);
});

test('stripVerifiedUfCommitsFromHubPayload drops Cyion from battle/heat nests', () => {
  const { value, changed } = stripVerifiedUfCommitsFromHubPayload({
    battleBoard: [
      { slug: 'cyion-smith', name: 'Cyion Smith' },
      { slug: 'hudson-west', name: 'Hudson West' },
    ],
    heatIndex: [{ id: 'cyion-smith', name: 'Cyion Smith' }],
    battles: [{ slug: 'armani-strong', name: 'Armani Strong' }],
    commits: [{ id: 'cyion-smith', name: 'Cyion Smith' }],
  });
  assert.equal(changed, true);
  assert.deepEqual(value.battleBoard.map((row) => row.slug), ['hudson-west']);
  assert.equal(value.heatIndex.length, 0);
  assert.equal(value.battles.length, 0);
  assert.equal(value.commits.length, 1);
});

test('buildBattleBoardRows skips verified UF commits even with RPM', () => {
  const rows = buildBattleBoardRows([
    {
      slug: 'cyion-smith',
      name: 'Cyion Smith',
      classYear: 2028,
      position: 'S',
      isCommit: false,
      isCommittedToUF: false,
      ufScore: 91,
      competitors: [{ school: 'Miami', score: 88 }],
      battleDifficulty: 'tossup',
      battleColor: 'amber',
    },
    {
      slug: 'hudson-west',
      name: 'Hudson West',
      classYear: 2028,
      position: 'TE',
      isCommit: false,
      ufScore: 88,
      competitors: [{ school: 'Georgia', score: 86 }],
      battleDifficulty: 'tossup',
      battleColor: 'amber',
    },
  ]);
  assert.equal(rows.some((row) => row.id === 'cyion-smith'), false);
  assert.equal(rows.some((row) => row.id === 'hudson-west'), true);
});
