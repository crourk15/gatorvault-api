'use strict';

const assert = require('assert');
const { describe, it } = require('node:test');
const {
  pickNextGame,
  pickLastCompleted,
  applyFinal,
  STATIC_LINES,
  getBettingLines,
} = require('../lib/betting-lines');

describe('betting-lines next game', () => {
  it('stays on FAU during kickoff and the postgame hold', () => {
    const during = pickNextGame(STATIC_LINES, new Date('2026-09-05T23:50:00.000Z'));
    assert.equal(during.id, 'uf-fau-2026-w1');
    const hold = pickNextGame(STATIC_LINES, new Date('2026-09-06T03:00:00.000Z'));
    assert.equal(hold.id, 'uf-fau-2026-w1');
  });

  it('advances to Campbell after the FAU postgame window', () => {
    const next = pickNextGame(STATIC_LINES, new Date('2026-09-06T12:00:00.000Z'));
    assert.equal(next.id, 'uf-campbell-2026-w2');
    const last = pickLastCompleted(STATIC_LINES, new Date('2026-09-06T12:00:00.000Z'));
    assert.equal(last.id, 'uf-fau-2026-w1');
  });

  it('applies the official FAU final onto the lines row', () => {
    const fau = STATIC_LINES.find((g) => g.id === 'uf-fau-2026-w1');
    const stamped = applyFinal(fau, {
      'uf-fau-2026-w1': { uf: 66, opp: 21, source: 'official' },
    });
    assert.equal(stamped.homeScore, 66);
    assert.equal(stamped.awayScore, 21);
    assert.equal(stamped.status, 'Final');
    assert.equal(stamped.completed, true);
  });

  it('serves Campbell as nextGame and FAU 66-21 as lastGame on Sep 6', async () => {
    const payload = await getBettingLines(new Date('2026-09-06T16:00:00.000Z'));
    assert.equal(payload.nextGame.id, 'uf-campbell-2026-w2');
    assert.equal(payload.lastGame.id, 'uf-fau-2026-w1');
    assert.equal(payload.lastGame.homeScore, 66);
    assert.equal(payload.lastGame.awayScore, 21);
    assert.equal(payload.finals['uf-fau-2026-w1'].uf, 66);
    assert.equal(payload.finals['uf-fau-2026-w1'].opp, 21);
  });
});
