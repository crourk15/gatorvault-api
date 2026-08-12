import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getSigningEvents, selectSigningBoardPlayers } from './signing-day-utils';

describe('selectSigningBoardPlayers', () => {
  const board = {
    commits: [
      {
        slug: 'maxwell-hiller',
        name: 'Maxwell Hiller',
        classYear: 2027,
        isCommittedToUF: true,
        committedTo: 'Florida',
        natlRank: 40,
      },
      {
        slug: 'armani-strong',
        name: 'Armani Strong',
        classYear: 2028,
        isCommittedToUF: true,
        committedTo: 'Florida',
        natlRank: 209,
      },
    ],
    targets: [
      {
        slug: 'tranard-roberts',
        name: 'Tranard Roberts',
        classYear: 2027,
        tier: 'HIGH',
        committedTo: null,
        natlRank: 80,
        ufProbability: 74,
        status: 'target',
      },
      {
        slug: 'hudson-west',
        name: 'Hudson West',
        classYear: 2028,
        tier: 'TOP',
        committedTo: null,
        natlRank: 10,
        ufProbability: 0.99,
        status: 'target',
      },
      {
        slug: 'easton-royal',
        name: 'Easton Royal',
        classYear: 2027,
        tier: 'TOP',
        committedTo: 'Texas',
        natlRank: 5,
        ufProbability: 0.99,
      },
    ],
  };

  it('ESP expected signees are UF commits — not Flip Watch TOP/HIGH', () => {
    const players = selectSigningBoardPlayers('esp', board, 2027);
    const slugs = players.map((p) => p.slug);
    assert.deepEqual(slugs, ['maxwell-hiller']);
    assert.ok(!slugs.includes('easton-royal'));
    assert.ok(!slugs.includes('armani-strong'));
  });

  it('2028 ESP / NSD never surface 2027 players', () => {
    const esp = selectSigningBoardPlayers('esp', board, 2028).map((p) => p.slug);
    const nsd = selectSigningBoardPlayers('nsd', board, 2028).map((p) => p.slug);
    assert.deepEqual(esp, ['armani-strong']);
    assert.deepEqual(nsd, ['hudson-west']);
    assert.ok(!esp.includes('maxwell-hiller'));
    assert.ok(!nsd.includes('tranard-roberts'));
    assert.ok(!nsd.includes('easton-royal'));
  });

  it('NSD remaining targets are open UF hunts only', () => {
    const players = selectSigningBoardPlayers('nsd', board, 2027);
    const slugs = players.map((p) => p.slug);
    assert.deepEqual(slugs, ['tranard-roberts']);
    assert.ok(!slugs.includes('easton-royal'));
  });

  it('signing deep links carry the class year', () => {
    const events = getSigningEvents(2028);
    assert.match(events.esp.linkHref, /year=2028/);
    assert.match(events.nsd.linkHref, /year=2028/);
  });
});
