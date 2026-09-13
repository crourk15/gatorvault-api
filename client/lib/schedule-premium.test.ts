import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SCHEDULE_GAMES } from './schedule-data';
import {
  getNextScheduleGame,
  getScheduleGameStatus,
  hasPostedFinal,
  toPremiumScheduleGame,
} from './schedule-premium';

describe('schedule-premium finals', () => {
  it('maps the official FAU final and box onto the schedule card', () => {
    const raw = SCHEDULE_GAMES.find((g) => g.id === 'fau');
    assert.ok(raw);
    const game = toPremiumScheduleGame(raw);
    assert.equal(game.finalUF, 66);
    assert.equal(game.finalOpp, 21);
    assert.equal(game.finalSource, 'official');
    assert.equal(
      game.boxScoreUrl,
      'https://floridagators.com/sports/football/stats/2026/florida-atlantic/boxscore/27903',
    );
    assert.equal(hasPostedFinal(game), true);
  });

  it('maps the official Campbell final onto the schedule card', () => {
    const raw = SCHEDULE_GAMES.find((g) => g.id === 'campbell');
    assert.ok(raw);
    const game = toPremiumScheduleGame(raw);
    assert.equal(game.finalUF, 52);
    assert.equal(game.finalOpp, 3);
    assert.equal(game.finalSource, 'official');
    assert.equal(hasPostedFinal(game), true);
  });

  it('leaves upcoming games without a posted final', () => {
    const raw = SCHEDULE_GAMES.find((g) => g.id === 'auburn');
    assert.ok(raw);
    const game = toPremiumScheduleGame(raw);
    assert.equal(game.finalUF, undefined);
    assert.equal(game.finalOpp, undefined);
    assert.equal(game.boxScoreUrl, undefined);
    assert.equal(hasPostedFinal(game), false);
  });

  it('opens Auburn Game Week once Campbell has a posted final after kick', () => {
    const games = SCHEDULE_GAMES.map(toPremiumScheduleGame);
    const beforeKick = new Date('2026-09-06T12:00:00-04:00');
    assert.equal(getNextScheduleGame(games, beforeKick)?.id, 'campbell');

    const insideOldHold = new Date('2026-09-12T22:18:00-04:00');
    assert.equal(getNextScheduleGame(games, insideOldHold)?.id, 'auburn');
    assert.equal(
      getScheduleGameStatus(games.find((g) => g.id === 'campbell')!, 'auburn', insideOldHold),
      'past',
    );

    const nextWeek = new Date('2026-09-13T12:00:00-04:00');
    assert.equal(getNextScheduleGame(games, nextWeek)?.id, 'auburn');
  });
});
