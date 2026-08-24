import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { __scheduleApiTest, fallbackScheduleGames } from './schedule-api';
import { SCHEDULE_GAMES } from './schedule-data';

const { normalizeGames, mergeUniform } = __scheduleApiTest;

describe('schedule-api uniforms', () => {
  it('seed includes FAU helmet/jersey/pants for Game Week cold paint', () => {
    const fau = SCHEDULE_GAMES.find((g) => g.id === 'fau');
    assert.equal(fau?.uniform?.helmet, 'Orange');
    assert.equal(fau?.uniform?.jersey, 'Blue');
    assert.equal(fau?.uniform?.pants, 'White');
    assert.ok((fallbackScheduleGames().filter((g) => g.uniform).length || 0) >= 12);
  });

  it('normalizeGames keeps live uniform when present', () => {
    const live = normalizeGames([
      {
        id: 'fau',
        label: 'Sep 5 vs FAU',
        opp: 'FAU Owls',
        date: 'September 5, 2026 · 7:45 PM ET',
        venue: 'Ben Hill Griffin Stadium, Gainesville FL',
        ufPct: 94,
        keys: [],
        swing: [],
        film: '',
        pred: '',
        predUF: 38,
        predOpp: 10,
        uniform: {
          helmet: 'Blue',
          jersey: 'Blue',
          pants: 'Blue',
          label: 'All-Blue',
        },
      },
    ]);
    assert.equal(live[0]?.uniform?.label, 'All-Blue');
    assert.equal(live[0]?.uniform?.helmet, 'Blue');
  });

  it('normalizeGames backfills seed uniform when live row omits it', () => {
    const live = normalizeGames([
      {
        id: 'fau',
        label: 'Sep 5 vs FAU',
        opp: 'FAU Owls',
        date: 'September 5, 2026 · 7:45 PM ET',
        venue: 'Ben Hill Griffin Stadium, Gainesville FL',
        ufPct: 94,
        keys: [],
        swing: [],
        film: '',
        pred: '',
        predUF: 38,
        predOpp: 10,
      },
    ]);
    assert.equal(live[0]?.uniform?.label, 'Orange / Blue / White');
    assert.equal(live[0]?.uniform?.helmet, 'Orange');
  });

  it('mergeUniform prefers live over seed', () => {
    const merged = mergeUniform(
      { helmet: 'Blue', jersey: 'Blue', pants: 'Blue', label: 'All-Blue' },
      { helmet: 'Orange', jersey: 'Blue', pants: 'White', label: 'Orange / Blue / White' }
    );
    assert.equal(merged?.label, 'All-Blue');
  });
});
