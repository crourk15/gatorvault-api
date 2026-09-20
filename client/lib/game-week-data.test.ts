import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fallbackDepthChartBoard } from './depth-chart-api';
import { SCHEDULE_GAMES } from './schedule-data';
import { getFeaturedUfGame } from './gators-live';
import {
  buildFilmNotes,
  buildRadar,
  defaultGameWeekId,
  resolveGameWeekId,
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

  it('Auburn Film Notes stay fan-facing and skip the Freeze downhill card', () => {
    const auburn = SCHEDULE_GAMES.find((g) => g.id === 'auburn');
    assert.ok(auburn);
    const notes = buildFilmNotes(auburn);
    assert.ok(notes.length >= 8);
    assert.match(notes[0], /no-huddle shotgun and Byrum Brown/i);
    assert.ok(!notes.some((n) => /downhill|Control LOS|NOT confirmed/i.test(n)));

    const bundle = getGameWeekBundle('auburn');
    assert.deepEqual(bundle.filmNotes, notes);
    assert.ok(bundle.scouting.offense.some((n) => /no-huddle shotgun/i.test(n)));
    assert.ok(bundle.scouting.defense.some((n) => /99 rush yards/i.test(n)));
    assert.ok(!bundle.scouting.offense.some((n) => DESK_SCOUT_TALK_RE.test(n)));
    assert.ok(!bundle.scouting.defense.some((n) => DESK_SCOUT_TALK_RE.test(n)));
    assert.ok(!DESK_SCOUT_TALK_RE.test(bundle.scouting.matchupSummary));
    assert.match(bundle.scouting.matchupSummary, /Byrum Brown/i);
    assert.equal(bundle.keys[0].title, 'Throw it over the loaded box');
    assert.equal(bundle.keys[1].title, 'Crowd Byrum Brown before the first read');
    assert.equal(bundle.keys[2].title, "Don't let the short throw become a long run");
    assert.match(bundle.keys[0].body, /Baylor got 103/i);
    assert.match(bundle.keys[0].body, /threw for 333/i);
    assert.match(bundle.keys[1].body, /three picks/i);
    assert.match(bundle.keys[1].body, /Crowd Byrum Brown/i);
    assert.match(bundle.keys[2].body, /Keshaun Singleton, Koger, Nimrod/i);
    assert.match(bundle.keys[2].body, /wrap them up/i);
    assert.ok(!bundle.keys.some((k) => /keep left 11|Koger 30|3rd-and-3/i.test(`${k.title} ${k.body}`)));
    assert.equal(auburn.filmWatched, false);
    assert.equal(auburn.filmLessonId, undefined);
    assert.equal(bundle.prediction.scoreLine, 'UF 27 · Auburn 23');
    assert.equal(bundle.prediction.spread, 'Line pending');
    const withVegas = getGameWeekBundle('auburn', SCHEDULE_GAMES, {
      spreadLine: 'UF -2.5',
      total: 51.5,
    });
    assert.equal(withVegas.prediction.spread, 'UF -2.5');
    assert.equal(withVegas.prediction.total, 'O/U 51.5');
  });

  it('Ole Miss Film Notes stay fan-facing and skip the tempo placeholder', () => {
    const olemiss = SCHEDULE_GAMES.find((g) => g.id === 'olemiss');
    assert.ok(olemiss);
    const notes = buildFilmNotes(olemiss);
    assert.ok(notes.length >= 8);
    assert.match(notes[0], /no-huddle shotgun and Trinidad Chambliss/i);
    assert.ok(!notes.some((n) => /tempo offense stresses|NOT confirmed/i.test(n)));

    const bundle = getGameWeekBundle('olemiss');
    assert.deepEqual(bundle.filmNotes, notes);
    assert.ok(bundle.scouting.offense.some((n) => /no-huddle shotgun/i.test(n)));
    assert.ok(bundle.scouting.defense.some((n) => /LSU ran for 172/i.test(n)));
    assert.ok(!bundle.scouting.offense.some((n) => DESK_SCOUT_TALK_RE.test(n)));
    assert.ok(!bundle.scouting.defense.some((n) => DESK_SCOUT_TALK_RE.test(n)));
    assert.ok(!DESK_SCOUT_TALK_RE.test(bundle.scouting.matchupSummary));
    assert.match(bundle.scouting.matchupSummary, /Trinidad Chambliss/i);
    assert.equal(bundle.keys[0].title, 'Attack a front that just gave LSU 172');
    assert.equal(bundle.keys[1].title, 'Crowd Chambliss before the first read');
    assert.equal(bundle.keys[2].title, "Don't let the short throw become a long run");
    assert.match(bundle.keys[0].body, /LSU ran for 172/i);
    assert.match(bundle.keys[1].body, /Crowd Chambliss/i);
    assert.match(bundle.keys[2].body, /Traylon Ray and Deuce Alexander/i);
    assert.equal(olemiss.filmWatched, false);
    assert.equal(bundle.prediction.scoreLine, 'UF 28 · Ole Miss 27');
    assert.equal(bundle.prediction.spread, 'Line pending');
    const withVegas = getGameWeekBundle('olemiss', SCHEDULE_GAMES, {
      spreadLine: 'UF +1.5',
      total: 58.5,
    });
    assert.equal(withVegas.prediction.spread, 'UF +1.5');
    assert.equal(withVegas.prediction.total, 'O/U 58.5');
    const radar = buildRadar(olemiss);
    assert.deepEqual(radar, olemiss.radar);
    assert.equal(radar.find((a) => a.label === 'Pass Efficiency')?.opp, 78);
    assert.equal(radar.find((a) => a.label === 'Front 7')?.opp, 48);
    assert.notDeepEqual(
      radar.find((a) => a.label === 'Run Game'),
      { label: 'Run Game', uf: 78, opp: 59 },
    );
  });

  it('defaults Game Week to the next upcoming kickoff', () => {
    assert.equal(defaultGameWeekId(SCHEDULE_GAMES, new Date('2026-09-04T18:00:00-04:00')), 'fau');
    assert.equal(defaultGameWeekId(SCHEDULE_GAMES, new Date('2026-09-06T12:00:00-04:00')), 'campbell');
    assert.equal(defaultGameWeekId(SCHEDULE_GAMES, new Date('2026-09-12T22:18:00-04:00')), 'auburn');
    assert.equal(defaultGameWeekId(SCHEDULE_GAMES, new Date('2026-09-13T12:00:00-04:00')), 'auburn');
    assert.equal(defaultGameWeekId(SCHEDULE_GAMES, new Date('2026-09-20T00:30:00-04:00')), 'olemiss');
    assert.equal(resolveGameWeekId(SCHEDULE_GAMES, new Date('2026-09-06T12:00:00-04:00'), 'auburn'), 'auburn');
    assert.equal(resolveGameWeekId(SCHEDULE_GAMES, new Date('2026-09-20T00:30:00-04:00'), 'olemiss'), 'olemiss');
    assert.equal(getFeaturedUfGame(new Date('2026-09-04T18:00:00-04:00'))?.id, 'fau');
    assert.equal(getFeaturedUfGame(new Date('2026-09-06T12:00:00-04:00'))?.id, 'campbell');
    assert.equal(getFeaturedUfGame(new Date('2026-09-13T12:00:00-04:00'))?.id, 'auburn');
    assert.equal(getFeaturedUfGame(new Date('2026-09-20T00:30:00-04:00'))?.id, 'olemiss');
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
