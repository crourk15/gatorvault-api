import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SCHEDULE_GAMES } from './schedule-data';
import { hasPostedFinal, toPremiumScheduleGame } from './schedule-premium';

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

  it('leaves upcoming games without a posted final', () => {
    const raw = SCHEDULE_GAMES.find((g) => g.id === 'campbell');
    assert.ok(raw);
    const game = toPremiumScheduleGame(raw);
    assert.equal(game.finalUF, undefined);
    assert.equal(game.finalOpp, undefined);
    assert.equal(game.boxScoreUrl, undefined);
    assert.equal(hasPostedFinal(game), false);
  });
});
