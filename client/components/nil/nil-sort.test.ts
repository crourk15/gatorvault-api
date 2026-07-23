import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sortNilPlayers } from './nil-sort';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';

function stub(partial: Partial<HighPriorityPlayer> & Pick<HighPriorityPlayer, 'slug' | 'name'>): HighPriorityPlayer {
  return {
    id: partial.slug,
    position: 'WR',
    school: null,
    htWt: null,
    stars: 4,
    headliner: false,
    committedTo: null,
    compositeScore: 0,
    nationalRank: 100,
    positionRank: null,
    stateRank: null,
    rating: null,
    natlRank: 100,
    posRank: null,
    movementDelta: 0,
    delta7d: 0,
    insiderNotes: null,
    notePreview: null,
    skinny: null,
    visitHistory: [],
    ufOvStatus: null,
    visitStart: null,
    visitEnd: null,
    trendHistory: [],
    predictors: [],
    ...partial,
  } as HighPriorityPlayer;
}

describe('sortNilPlayers', () => {
  it('UF Targets only includes active open targets', () => {
    const rows = sortNilPlayers(
      [
        stub({ slug: 'open-a', name: 'Open A', fitScore: 80 }),
        stub({ slug: 'gone-b', name: 'Gone B', fitScore: 99, committedTo: 'Georgia' }),
        stub({ slug: 'uf-c', name: 'UF C', fitScore: 70, committedTo: 'Florida' }),
      ],
      'targets'
    );
    assert.deepEqual(
      rows.map((r) => r.slug),
      ['open-a']
    );
  });

  it('Biggest Movers ranks by absolute board movement', () => {
    const rows = sortNilPlayers(
      [
        stub({ slug: 'small', name: 'Small', delta7d: 1 }),
        stub({ slug: 'big-up', name: 'Big Up', delta7d: 8 }),
        stub({ slug: 'big-down', name: 'Big Down', movementDelta: -6 }),
      ],
      'movers'
    );
    assert.deepEqual(
      rows.map((r) => r.slug),
      ['big-up', 'big-down']
    );
  });
});
