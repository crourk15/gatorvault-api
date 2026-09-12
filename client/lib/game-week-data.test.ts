import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fallbackDepthChartBoard } from './depth-chart-api';
import { SCHEDULE_GAMES } from './schedule-data';
import { getFeaturedUfGame } from './gators-live';
import {
  buildFilmNotes,
  defaultGameWeekId,
  DESK_SCOUT_TALK_RE,
  getGameWeekBundle,
} from './game-week-data';

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
    assert.ok(bundle.scouting.offense.some((n) => /Shotgun every snap/i.test(n)));
    assert.ok(bundle.scouting.defense.some((n) => /200 rush yards/i.test(n)));
    assert.ok(!bundle.scouting.offense.some((n) => DESK_SCOUT_TALK_RE.test(n)));
    assert.ok(!bundle.scouting.defense.some((n) => DESK_SCOUT_TALK_RE.test(n)));
    assert.ok(!DESK_SCOUT_TALK_RE.test(bundle.scouting.matchupSummary));
  });

  it('Campbell Film Notes stay fan-facing and skip the raw scout dump', () => {
    const campbell = SCHEDULE_GAMES.find((g) => g.id === 'campbell');
    assert.ok(campbell);
    const notes = buildFilmNotes(campbell);
    assert.equal(notes.length, 7);
    assert.match(notes[0], /Campbell is Sixkiller/i);
    assert.ok(notes.some((n) => /No-huddle shotgun/i.test(n)));
    assert.ok(!notes.some((n) => /NOT confirmed|gocamels cumulative|29\/42/i.test(n)));

    const bundle = getGameWeekBundle('campbell');
    assert.deepEqual(bundle.filmNotes, notes);
    assert.ok(bundle.scouting.offense.some((n) => /No-huddle shotgun/i.test(n)));
    assert.ok(bundle.scouting.defense.some((n) => /37 a game/i.test(n)));
    assert.ok(!bundle.scouting.offense.some((n) => DESK_SCOUT_TALK_RE.test(n) || /29\/42/.test(n)));
    assert.ok(!bundle.scouting.defense.some((n) => DESK_SCOUT_TALK_RE.test(n)));
    assert.ok(!DESK_SCOUT_TALK_RE.test(bundle.scouting.matchupSummary));
    assert.match(bundle.scouting.matchupSummary, /Campbell is Sixkiller/i);
    assert.match(bundle.scouting.matchupSummary, /37 a game/i);
    assert.equal(bundle.keys[0].title, 'Crowd Sixkiller before the first read');
    assert.equal(bundle.keys[1].title, "Attack last year's run defense");
    assert.equal(bundle.keys[2].title, 'Chunk shots vs a 5-INT secondary');
    assert.match(bundle.keys[0].body, /help over the top/i);
    assert.match(bundle.keys[1].body, /Establish Baugh/i);
    assert.match(bundle.keys[2].body, /27 pass TDs vs 5 INTs/i);
    assert.equal(campbell.filmWatched, true);
    assert.equal(campbell.filmLessonId, undefined);
    assert.equal(bundle.prediction.spread, 'Line pending');
    const withVegas = getGameWeekBundle('campbell', SCHEDULE_GAMES, {
      spreadLine: 'UF -49.5',
      total: 66.5,
    });
    assert.equal(withVegas.prediction.spread, 'UF -49.5');
    assert.equal(withVegas.prediction.total, 'O/U 66.5');
  });

  it('defaults Game Week to the next upcoming kickoff', () => {
    assert.equal(defaultGameWeekId(SCHEDULE_GAMES, new Date('2026-09-04T18:00:00-04:00')), 'fau');
    assert.equal(defaultGameWeekId(SCHEDULE_GAMES, new Date('2026-09-06T12:00:00-04:00')), 'campbell');
    assert.equal(defaultGameWeekId(SCHEDULE_GAMES, new Date('2026-09-13T12:00:00-04:00')), 'auburn');
    assert.equal(getFeaturedUfGame(new Date('2026-09-04T18:00:00-04:00'))?.id, 'fau');
    assert.equal(getFeaturedUfGame(new Date('2026-09-06T12:00:00-04:00'))?.id, 'campbell');
    assert.equal(getFeaturedUfGame(new Date('2026-09-13T12:00:00-04:00'))?.id, 'auburn');
  });

  it('Game Week depth board is the official two-deep, not the placeholder dump', () => {
    const board = fallbackDepthChartBoard();
    const labels = board.depthChart.offense.map((p) => p.label);
    assert.ok(labels.includes('WR (X)'));
    assert.ok(labels.includes('LT'));
    assert.ok(!labels.includes('OL'));
    assert.ok(board.depthChart.defense.some((p) => p.label === 'JACK'));
    assert.ok(board.depthChart.offense[0].players[0].name.includes('Philo'));
    assert.ok(!board.depthChart.offense[0].players.some((p) => /Will Griffin/i.test(p.name)));
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
