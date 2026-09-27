import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildGameDayView, gameDayBadge } from './home-command-utils';
import type { ScheduleGame } from '../../../../lib/schedule-data';

function stubGame(partial: Partial<ScheduleGame> & Pick<ScheduleGame, 'id' | 'opp' | 'date'>): ScheduleGame {
  return {
    label: partial.label || partial.id,
    venue: partial.venue || 'Faurot Field, Columbia MO',
    ufPct: 65,
    keys: [],
    swing: [],
    film: '',
    pred: '',
    predUF: 28,
    predOpp: 21,
    ...partial,
  };
}

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

  it('advances the home card to Ole Miss after the Auburn final', () => {
    const view = buildGameDayView(new Date('2026-09-20T04:30:00.000Z'));
    assert.equal(view.gameId, 'olemiss');
    assert.equal(view.isRival, false);
  });

  it('paints the live Missouri 3:30 kickoff, not a leftover SEC window', () => {
    const view = buildGameDayView(new Date('2026-09-27T16:00:00.000Z'), [
      stubGame({
        id: 'olemiss',
        opp: 'Ole Miss Rebels',
        date: 'September 26, 2026 · 3:30 PM ET',
        venue: 'Ben Hill Griffin Stadium, Gainesville FL',
        finalUF: 52,
        finalOpp: 28,
      }),
      stubGame({
        id: 'missouri',
        opp: 'Missouri Tigers',
        date: 'October 3, 2026 · 3:30 PM ET',
        tv: 'ESPN',
      }),
    ]);
    assert.equal(view.gameId, 'missouri');
    assert.equal(view.dateLabel, 'October 3, 2026 · 3:30 PM ET');
    assert.equal(/3:30\s*[-–]\s*8:00/.test(view.dateLabel), false);
  });
});
