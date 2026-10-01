import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  careerSeasonsForPos,
  formatGameStatLine,
  groupProductionGames,
  seasonStripItems,
} from './roster-production-stats';
import type { ProductionStats } from './roster-api';

const philo2026: ProductionStats = {
  source: 'official',
  syncedAt: '2026-10-01T00:28:02.506Z',
  cfbdPlayerId: null,
  matchConfidence: null,
  seasons: [
    {
      season: 2026,
      team: 'Florida',
      category: 'passing',
      stats: { cmp: 63, att: 87, yds: 917, td: 7, int: 2, lng: 63, avg: 10.5 },
    },
    {
      season: 2026,
      team: 'Florida',
      category: 'rushing',
      stats: { car: 24, yds: 69, td: 3, lng: 12, avg: 2.9 },
    },
  ],
  recentGames: [
    {
      season: 2026,
      week: 4,
      date: '2026-09-26T23:55:00.000Z',
      opponent: 'Ole Miss',
      homeAway: 'home',
      category: 'rushing',
      stats: { car: 6, yds: 14, td: 1, lng: 6, avg: 2.3 },
    },
    {
      season: 2026,
      week: 4,
      date: '2026-09-26T23:55:00.000Z',
      opponent: 'Ole Miss',
      homeAway: 'home',
      category: 'passing',
      stats: { cmp: 16, att: 23, yds: 196, td: 1, int: 0, lng: 38, avg: 8.5 },
    },
    {
      season: 2026,
      week: 3,
      date: '2026-09-19T23:55:00.000Z',
      opponent: 'Auburn',
      homeAway: 'away',
      category: 'passing',
      stats: { cmp: 15, att: 22, yds: 204, td: 1, int: 1, lng: 37, avg: 9.3 },
    },
  ],
};

describe('roster production stats display', () => {
  it('shows CMP/ATT YDS TD INT for a passing season — not a lone CMP', () => {
    const strip = seasonStripItems(philo2026.seasons[0]);
    assert.deepEqual(
      strip.map((item) => `${item.label} ${item.value}`),
      ['CMP/ATT 63/87', 'YDS 917', 'TD 7', 'INT 2']
    );
  });

  it('formats a passing game as 16/23 · 196 · TD · INT', () => {
    const line = formatGameStatLine(philo2026.recentGames[1]);
    assert.equal(line, '16/23 · YDS 196 · TD 1 · INT 0');
  });

  it('groups Ole Miss passing + rushing onto one game card', () => {
    const grouped = groupProductionGames(philo2026.recentGames);
    assert.equal(grouped.length, 2);
    assert.equal(grouped[0].opponent, 'Ole Miss');
    assert.equal(grouped[0].week, 4);
    assert.deepEqual(
      grouped[0].lines.map((line) => line.category),
      ['passing', 'rushing']
    );
    assert.equal(grouped[1].opponent, 'Auburn');
  });

  it('career list keeps 2026 passing and rushing for a QB', () => {
    const career = careerSeasonsForPos(philo2026, 'QB');
    assert.deepEqual(
      career.map((row) => `${row.season} ${row.category}`),
      ['2026 passing', '2026 rushing']
    );
  });
});
