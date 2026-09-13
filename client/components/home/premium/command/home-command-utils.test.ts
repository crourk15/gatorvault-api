import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildGameDayView, gameDayBadge } from './home-command-utils';

describe('home Game Week badge', () => {
  it('does not tag Auburn as rivalry week', () => {
    const view = buildGameDayView(new Date('2026-09-13T16:00:00.000Z'));
    assert.equal(view.gameId, 'auburn');
    assert.equal(view.isRival, false);
    assert.equal(gameDayBadge(6, view.isRival), 'GAME WEEK');
  });

  it('keeps rivalry week for UGA and FSU only', () => {
    assert.equal(gameDayBadge(10, true), 'RIVALRY WEEK');
    assert.equal(gameDayBadge(10, false), null);
  });
});
