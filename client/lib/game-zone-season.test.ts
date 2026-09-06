import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SCHEDULE_GAMES } from './schedule-data';
import { finalForTicket, resolveFinalScore } from './game-zone-season';

describe('Game Zone finals', () => {
  it('reads the official FAU final from the schedule slate', () => {
    const fau = SCHEDULE_GAMES.find((g) => g.id === 'fau');
    assert.equal(fau?.finalUF, 66);
    assert.equal(fau?.finalOpp, 21);
    const resolved = resolveFinalScore(null, fau, 'uf-fau-2026-w1');
    assert.deepEqual(resolved, { uf: 66, opp: 21, source: 'schedule' });
  });

  it('grades a leftover FAU ticket after Game Zone advances to Campbell', () => {
    const final = finalForTicket(
      { gameKey: 'uf-fau-2026-w1', scheduleId: 'fau', opponent: 'FAU' },
      { games: SCHEDULE_GAMES, nextGame: { id: 'uf-campbell-2026-w2', opponent: 'Campbell' } },
    );
    assert.deepEqual(final, { uf: 66, opp: 21, source: 'schedule' });
  });

  it('uses a completed overlay even when team names are missing', () => {
    const resolved = resolveFinalScore(
      { completed: true, homeScore: 66, awayScore: 21, status: 'Final' },
      null,
      'uf-fau-2026-w1',
    );
    assert.deepEqual(resolved, { uf: 66, opp: 21, source: 'lines' });
  });
});
