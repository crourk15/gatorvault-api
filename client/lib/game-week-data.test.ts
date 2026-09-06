import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SCHEDULE_GAMES } from './schedule-data';
import { buildFilmNotes, defaultGameWeekId, getGameWeekBundle } from './game-week-data';

describe('Game Week Film Notes', () => {
  it('FAU Film Notes stay fan-facing and skip the raw scout dump', () => {
    const fau = SCHEDULE_GAMES.find((g) => g.id === 'fau');
    assert.ok(fau);
    const notes = buildFilmNotes(fau);
    assert.equal(notes.length, 6);
    assert.match(notes[0], /Shotgun every snap/i);
    assert.ok(!notes.some((n) => /401762477|NOT confirmed|Tied-130th|highlight packages/i.test(n)));

    const bundle = getGameWeekBundle('fau');
    assert.deepEqual(bundle.filmNotes, notes);
    assert.ok(bundle.scouting.offense.some((n) => /Veltkamp 24\/33/.test(n)));
    assert.ok(bundle.scouting.defense.some((n) => /Tied-130th|NOT confirmed/i.test(n)));
  });

  it('Campbell Film Notes stay fan-facing and skip the raw scout dump', () => {
    const campbell = SCHEDULE_GAMES.find((g) => g.id === 'campbell');
    assert.ok(campbell);
    const notes = buildFilmNotes(campbell);
    assert.equal(notes.length, 6);
    assert.match(notes[0], /No-huddle shotgun/i);
    assert.ok(!notes.some((n) => /NOT confirmed|gocamels cumulative|29\/42/i.test(n)));

    const bundle = getGameWeekBundle('campbell');
    assert.deepEqual(bundle.filmNotes, notes);
    assert.ok(bundle.scouting.offense.some((n) => /29\/42/.test(n)));
    assert.ok(bundle.scouting.defense.some((n) => /NOT confirmed|Brandon Butcher/i.test(n)));
    assert.equal(bundle.keys[0].title, 'Crowd Sixkiller before the first read');
    assert.equal(campbell.filmWatched, true);
    assert.equal(campbell.filmLessonId, undefined);
    assert.ok(bundle.scouting.offense.some((n) => /Film-confirmed/i.test(n)));
    assert.equal(bundle.prediction.spread, 'Line pending');
  });

  it('defaults Game Week to the next upcoming kickoff', () => {
    assert.equal(defaultGameWeekId(SCHEDULE_GAMES, new Date('2026-09-04T18:00:00-04:00')), 'fau');
    assert.equal(defaultGameWeekId(SCHEDULE_GAMES, new Date('2026-09-06T12:00:00-04:00')), 'campbell');
  });

  it('falls back to film when filmNotes is missing', () => {
    const notes = buildFilmNotes({
      id: 'x',
      label: 'x',
      opp: 'x',
      date: 'x',
      venue: 'x',
      ufPct: 50,
      keys: [],
      swing: [],
      film: 'One film line.',
      pred: '',
      predUF: 0,
      predOpp: 0,
      opponentTendencies: ['RAW scout should not appear'],
      defenseTendencies: ['RAW defense should not appear'],
    });
    assert.deepEqual(notes, ['One film line.']);
  });
});
