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
  });

  it('Campbell Film Notes are fan-facing and raw scout stays on file', () => {
    const board = scheduleBoard.getScheduleBoard(2026);
    const campbell = board.games.find((g) => g.id === 'campbell');
    assert.ok(campbell.filmNotes?.length >= 6);
    assert.match(campbell.filmNotes[0], /Sixkiller is the show/i);
    assert.ok(!campbell.filmNotes.some((n) => /NOT confirmed|Hudl watch|gocamels cumulative/i.test(n)));
    assert.match(campbell.film, /What the boxes show vs Campbell/i);
    assert.ok(campbell.offenseScout?.some((n) => /29\/42/.test(n)));
    assert.ok(campbell.defenseScout?.some((n) => /NOT confirmed|Brandon Butcher/i.test(n)));
    assert.ok(campbell.opponentTendencies.every((n) => !/NOT confirmed|Hudl/i.test(n)));
    const iosDump = [campbell.film, ...(campbell.opponentTendencies || []), ...(campbell.defenseTendencies || [])];
    assert.ok(!iosDump.some((n) => /NOT confirmed|Hudl watch|gocamels cumulative/i.test(n)));
    assert.equal(campbell.keys[0], 'Crowd Sixkiller before the first read');
    assert.equal(campbell.filmWatched, false);
    assert.equal(campbell.filmLessonId, undefined);
    assert.ok(campbell.offenseScout.some((n) => /PROVISIONAL/.test(n)));
    assert.ok(!campbell.filmNotes.some((n) => /tape we have/i.test(n)));
  });

  it('bundle path points at repo seed', () => {
    const p = scheduleBoard.resolveReadPath(2026);
    assert.ok(p.includes(path.join('data', 'schedule', '2026-season.json')));
  });
});
