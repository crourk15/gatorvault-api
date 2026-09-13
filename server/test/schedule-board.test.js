'use strict';

const assert = require('assert');
const path = require('path');
const { describe, it } = require('node:test');
const scheduleBoard = require('../lib/schedule-board');

describe('schedule-board', () => {
  it('loads 2026 slate with Oklahoma + road Kentucky', () => {
    const board = scheduleBoard.getScheduleBoard(2026);
    assert.equal(board.season, 2026);
    assert.ok(board.games.length >= 12);
    const ids = board.games.map((g) => g.id);
    assert.ok(ids.includes('oklahoma'), 'missing oklahoma');
    assert.ok(ids.includes('kentucky'), 'missing kentucky');
    const ou = board.games.find((g) => g.id === 'oklahoma');
    assert.match(ou.label, /Oklahoma/i);
    assert.match(ou.venue, /Ben Hill Griffin/i);
    const uk = board.games.find((g) => g.id === 'kentucky');
    assert.match(uk.label, /@ Kentucky/i);
    assert.match(uk.venue, /Lexington/i);
  });

  it('toApiPayload marks ok + count', () => {
    const payload = scheduleBoard.toApiPayload();
    assert.equal(payload.ok, true);
    assert.equal(payload.count, payload.games.length);
    assert.ok(payload.updatedAt);
    assert.equal(payload.currentGameId, 'auburn');
    const campbell = payload.games.find((g) => g.id === 'campbell');
    assert.equal(campbell.finalUF, 52);
    assert.equal(campbell.finalOpp, 3);
  });

  function oldIosBuildScouting(game) {
    return {
      offense: game.offenseScout?.length ? game.offenseScout : game.opponentTendencies,
      defense: game.defenseScout?.length ? game.defenseScout : game.defenseTendencies,
      matchupSummary: game.scoutingReport ?? game.film,
    };
  }

  it('public toApiPayload empties desk scout so current iOS falls back to fan copy', () => {
    const board = scheduleBoard.getScheduleBoard(2026);
    const payload = scheduleBoard.toApiPayload(board);
    const campbell = payload.games.find((g) => g.id === 'campbell');
    const file = board.games.find((g) => g.id === 'campbell');
    assert.ok(file.offenseScout?.some((n) => /Film-confirmed/i.test(n)));
    assert.deepEqual(campbell.offenseScout, []);
    assert.deepEqual(campbell.defenseScout, []);
    assert.equal(campbell.scoutingReport, undefined);
    assert.ok(campbell.opponentTendencies?.some((n) => /No-huddle shotgun/i.test(n)));
    assert.match(String(campbell.film), /Campbell is Sixkiller/i);
    const dump = [
      campbell.film,
      ...(campbell.offenseScout || []),
      ...(campbell.defenseScout || []),
      campbell.scoutingReport,
      ...(campbell.opponentTendencies || []),
      ...(campbell.defenseTendencies || []),
    ].filter(Boolean);
    assert.ok(!dump.some((n) => /Film-confirmed|NOT confirmed|box-confirmed/i.test(n)));
    const ios = oldIosBuildScouting(campbell);
    assert.ok(ios.offense.some((n) => /No-huddle shotgun/i.test(n)));
    assert.ok(!ios.offense.some((n) => /Film-confirmed/i.test(n)));
    assert.match(String(ios.matchupSummary), /Campbell is Sixkiller/i);
    assert.ok(!/NOT confirmed/i.test(String(ios.matchupSummary)));
  });

  it('desk toApiPayload keeps raw scout for Admin Hub', () => {
    const payload = scheduleBoard.toApiPayload(undefined, { includeDeskScout: true });
    const campbell = payload.games.find((g) => g.id === 'campbell');
    assert.ok(campbell.offenseScout?.some((n) => /Film-confirmed/i.test(n)));
    assert.ok(campbell.scoutingReport);
  });

  it('game-week meta games also hide desk scout', () => {
    const feed = require('../lib/game-week-feed');
    const payload = feed.buildGameWeekPayload();
    assert.equal(payload.currentGameId, 'auburn');
    const campbell = payload.games.find((g) => g.id === 'campbell');
    assert.deepEqual(campbell.offenseScout, []);
    assert.equal(campbell.scoutingReport, undefined);
  });


  it('aligns 2026 slate to official windows + Atlanta UGA + bye', () => {
    const board = scheduleBoard.getScheduleBoard(2026);
    const uga = board.games.find((g) => g.id === 'uga');
    assert.match(uga.venue, /Mercedes-Benz/i);
    assert.match(uga.venue, /Atlanta/i);
    assert.equal(uga.tv, 'ABC');
    const campbell = board.games.find((g) => g.id === 'campbell');
    assert.equal(campbell.tv, 'SECN+');
    const mizzou = board.games.find((g) => g.id === 'missouri');
    assert.match(mizzou.venue, /Faurot/i);
    assert.match(mizzou.date, /3:30/);
    const bye = board.games.find((g) => g.id === 'bye-oct24');
    assert.equal(bye.kind, 'bye');
    assert.match(bye.date, /OFF/i);
    // SEC Championship is not a Florida scheduled game
    assert.ok(!board.games.some((g) => /championship/i.test(g.opp || '')));
    assert.equal(board.games.filter((g) => g.kind !== 'bye').length, 12);
  });

  it('FAU Film Notes are fan-facing and raw scout stays on file', () => {
    const board = scheduleBoard.getScheduleBoard(2026);
    const fau = board.games.find((g) => g.id === 'fau');
    assert.ok(fau.filmNotes?.length >= 6);
    assert.match(fau.filmNotes[0], /Shotgun every snap/i);
    assert.ok(!fau.filmNotes.some((n) => /401762477|NOT confirmed|Tied-130th/i.test(n)));
    assert.match(fau.film, /What the tape shows vs FAU/i);
    assert.ok(fau.offenseScout?.some((n) => /Veltkamp 24\/33/.test(n)));
    assert.ok(fau.defenseScout?.some((n) => /Tied-130th|NOT confirmed/i.test(n)));
    assert.ok(fau.opponentTendencies.every((n) => !/NOT confirmed|Tied-130th|401762/.test(n)));
    const iosDump = [fau.film, ...(fau.opponentTendencies || []), ...(fau.defenseTendencies || [])];
    assert.ok(!iosDump.some((n) => /NOT confirmed|Tied-130th|401762|highlight packages/i.test(n)));
    assert.equal(iosDump.length, 7);
    assert.equal(fau.finalUF, 66);
    assert.equal(fau.finalOpp, 21);
    assert.equal(
      fau.boxScoreUrl,
      'https://floridagators.com/sports/football/stats/2026/florida-atlantic/boxscore/27903',
    );
    assert.equal(fau.vaultReviewId, undefined);
  });

  it('Campbell Film Notes are fan-facing and raw scout stays on file', () => {
    const board = scheduleBoard.getScheduleBoard(2026);
    const campbell = board.games.find((g) => g.id === 'campbell');
    assert.ok(campbell.filmNotes?.length >= 7);
    assert.match(campbell.filmNotes[0], /Campbell is Sixkiller/i);
    assert.ok(campbell.filmNotes.some((n) => /No-huddle shotgun/i.test(n)));
    assert.ok(!campbell.filmNotes.some((n) => /NOT confirmed|gocamels cumulative|29\/42/i.test(n)));
    assert.match(campbell.film, /Campbell is Sixkiller/i);
    assert.match(campbell.film, /37 a game/i);
    assert.ok(campbell.offenseScout?.some((n) => /29\/42/.test(n)));
    assert.ok(campbell.offenseScout?.some((n) => /No Huddle-Shotgun/i.test(n)));
    assert.ok(campbell.defenseScout?.some((n) => /NOT confirmed|Brandon Butcher/i.test(n)));
    assert.ok(campbell.opponentTendencies.every((n) => !/NOT confirmed|Hudl/i.test(n)));
    const iosDump = [campbell.film, ...(campbell.opponentTendencies || []), ...(campbell.defenseTendencies || [])];
    assert.ok(!iosDump.some((n) => /NOT confirmed|gocamels cumulative/i.test(n)));
    assert.equal(iosDump.length, 7);
    assert.equal(campbell.keys[0], 'Crowd Sixkiller before the first read');
    assert.equal(campbell.keys[1], "Attack last year's run defense");
    assert.equal(campbell.keys[2], 'Chunk shots vs a 5-INT secondary');
    assert.match(campbell.howUFWins[0], /help over the top/i);
    assert.match(campbell.howUFWins[1], /Establish Baugh/i);
    assert.match(campbell.howUFWins[2], /27 pass TDs vs 5 INTs/i);
    assert.ok(!campbell.keys.some((k) => /turn this into 49|vertical get behind you/i.test(k)));
    assert.equal(campbell.filmWatched, true);
    assert.equal(campbell.filmLessonId, undefined);
    assert.ok(campbell.offenseScout.some((n) => /Film-confirmed/i.test(n)));
  });

  it('Auburn Film Notes are fan-facing and raw scout stays on file', () => {
    const board = scheduleBoard.getScheduleBoard(2026);
    const auburn = board.games.find((g) => g.id === 'auburn');
    assert.ok(auburn.filmNotes?.length >= 8);
    assert.match(auburn.filmNotes[0], /no-huddle shotgun and Byrum Brown/i);
    assert.ok(!auburn.filmNotes.some((n) => /NOT confirmed|Freeze downhill|401856636/i.test(n)));
    assert.match(auburn.film, /no-huddle shotgun and Byrum Brown/i);
    assert.ok(!/downhill ball/i.test(auburn.film));
    assert.equal(auburn.keys[0], 'Crowd Brown');
    assert.equal(auburn.keys[1], 'Stay in the lane on the keep');
    assert.equal(auburn.keys[2], 'Don’t let the short throw run');
    assert.equal(auburn.pred, 'UF 27 · Auburn 23');
    assert.equal(auburn.filmWatched, false);
    assert.equal(auburn.filmLessonId, undefined);
    assert.ok(auburn.offenseScout?.some((n) => /No Huddle-Shotgun/i.test(n)));
    assert.ok(auburn.defenseScout?.some((n) => /NOT confirmed|Durkin/i.test(n)));
    const payload = scheduleBoard.toApiPayload(board);
    const fan = payload.games.find((g) => g.id === 'auburn');
    assert.deepEqual(fan.offenseScout, []);
    assert.equal(fan.scoutingReport, undefined);
    assert.match(fan.film, /Byrum Brown/i);
  });

  it('bundle path points at repo seed', () => {
    const p = scheduleBoard.resolveReadPath(2026);
    assert.ok(p.includes(path.join('data', 'schedule', '2026-season.json')));
  });
});
