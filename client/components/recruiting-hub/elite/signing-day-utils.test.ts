import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { selectSigningBoardPlayers } from './signing-day-utils';

describe('selectSigningBoardPlayers', () => {
  const board = {
    commits: [
      {
        slug: 'maxwell-hiller',
        name: 'Maxwell Hiller',
        isCommittedToUF: true,
        committedTo: 'Florida',
        natlRank: 40,
      },
      {
        slug: 'davin-davidson',
        name: 'Davin Davidson',
        isCommittedToUF: true,
        committedTo: 'Florida',
        natlRank: 12,
      },
    ],
    targets: [
      {
        slug: 'easton-royal',
        name: 'Easton Royal',
        tier: 'TOP',
        committedTo: 'Texas',
        natlRank: 5,
        ufProbability: 0.99,
      },
      {
        slug: 'jalen-brewster',
        name: 'Jalen Brewster',
        tier: 'TOP',
        committedTo: 'Georgia',
        natlRank: 5,
      },
      {
        slug: 'tranard-roberts',
        name: 'Tranard Roberts',
        tier: 'HIGH',
        committedTo: null,
        natlRank: 80,
        ufProbability: 74,
        status: 'target',
      },
    ],
  };

  it('ESP expected signees are UF commits — not Flip Watch TOP/HIGH', () => {
    const players = selectSigningBoardPlayers('esp', board);
    const slugs = players.map((p) => p.slug);
    assert.deepEqual(slugs, ['davin-davidson', 'maxwell-hiller']);
    assert.ok(!slugs.includes('easton-royal'));
    assert.ok(!slugs.includes('jalen-brewster'));
  });

  it('NSD remaining targets are open UF hunts only', () => {
    const players = selectSigningBoardPlayers('nsd', board);
    const slugs = players.map((p) => p.slug);
    assert.deepEqual(slugs, ['tranard-roberts']);
    assert.ok(!slugs.includes('easton-royal'));
    assert.ok(!slugs.includes('jalen-brewster'));
  });
});
