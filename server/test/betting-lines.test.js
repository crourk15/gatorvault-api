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
    assert.equal(payload.nextGame.spread.line, 'UF -49.5');
    assert.equal(payload.nextGame.spread.uf, -49.5);
    assert.equal(payload.nextGame.total, 66.5);
  });

  it('advances to Auburn after the Campbell postgame window', () => {
    const next = pickNextGame(STATIC_LINES, new Date('2026-09-13T12:00:00.000Z'));
    assert.equal(next.id, 'uf-auburn-2026-w3');
    const last = pickLastCompleted(STATIC_LINES, new Date('2026-09-13T12:00:00.000Z'));
    assert.equal(last.id, 'uf-campbell-2026-w2');
  });

  it('serves Auburn as nextGame with UF -2.5 / 51.5 on Sep 13', async () => {
    const payload = await getBettingLines(new Date('2026-09-13T16:00:00.000Z'));
    assert.equal(payload.nextGame.id, 'uf-auburn-2026-w3');
    assert.equal(payload.nextGame.spread.line, 'UF -2.5');
    assert.equal(payload.nextGame.spread.uf, -2.5);
    assert.equal(payload.nextGame.total, 51.5);
    assert.equal(payload.lastGame.id, 'uf-campbell-2026-w2');
    assert.equal(payload.lastGame.homeScore, 52);
    assert.equal(payload.lastGame.awayScore, 3);
  });

  it('advances to Ole Miss after the Auburn postgame window', () => {
    const next = pickNextGame(STATIC_LINES, new Date('2026-09-20T12:00:00.000Z'));
    assert.equal(next.id, 'uf-olemiss-2026-w4');
    const last = pickLastCompleted(STATIC_LINES, new Date('2026-09-20T12:00:00.000Z'));
    assert.equal(last.id, 'uf-auburn-2026-w3');
  });

  it('serves Ole Miss as nextGame with UF +1.5 / 58.5 on Sep 20', async () => {
    const payload = await getBettingLines(new Date('2026-09-20T16:00:00.000Z'));
    assert.equal(payload.nextGame.id, 'uf-olemiss-2026-w4');
    assert.equal(payload.nextGame.spread.line, 'UF +1.5');
    assert.equal(payload.nextGame.spread.uf, 1.5);
    assert.equal(payload.nextGame.total, 58.5);
    assert.equal(payload.lastGame.id, 'uf-auburn-2026-w3');
    assert.equal(payload.lastGame.homeScore, 44);
    assert.equal(payload.lastGame.awayScore, 39);
  });

  it('does not invent an LSU line Florida does not play in 2026', () => {
    assert.ok(STATIC_LINES.some((g) => g.id === 'uf-olemiss-2026-w4'));
    assert.ok(!STATIC_LINES.some((g) => /lsu/i.test(String(g.id || ''))));
  });

  it('advances to Missouri after the Ole Miss postgame window', () => {
    const next = pickNextGame(STATIC_LINES, new Date('2026-09-27T12:00:00.000Z'));
    assert.equal(next.id, 'uf-missouri-2026-w5');
    const last = pickLastCompleted(STATIC_LINES, new Date('2026-09-27T12:00:00.000Z'));
    assert.equal(last.id, 'uf-olemiss-2026-w4');
  });

  it('serves Missouri as nextGame with UF -5.5 / 56.5 on Sep 27', async () => {
    const payload = await getBettingLines(new Date('2026-09-27T12:00:00.000Z'));
    assert.equal(payload.nextGame.id, 'uf-missouri-2026-w5');
    assert.equal(payload.nextGame.spread.line, 'UF -5.5');
    assert.equal(payload.nextGame.spread.uf, -5.5);
    assert.equal(payload.nextGame.total, 56.5);
    assert.equal(payload.nextGame.moneyline.uf, -205);
    assert.equal(payload.nextGame.moneyline.opp, 170);
    assert.equal(payload.lastGame.id, 'uf-olemiss-2026-w4');
    assert.equal(payload.lastGame.homeScore, 52);
    assert.equal(payload.lastGame.awayScore, 28);
  });

  it('advances to South Carolina after the Missouri postgame window', () => {
    const next = pickNextGame(STATIC_LINES, new Date('2026-10-04T12:00:00.000Z'));
    assert.equal(next.id, 'uf-scar-2026-w6');
    const last = pickLastCompleted(STATIC_LINES, new Date('2026-10-04T12:00:00.000Z'));
    assert.equal(last.id, 'uf-missouri-2026-w5');
  });

  it('serves South Carolina as nextGame with UF -13.5 / 62.5 on Oct 6', async () => {
    const payload = await getBettingLines(new Date('2026-10-06T12:00:00.000Z'));
    assert.equal(payload.nextGame.id, 'uf-scar-2026-w6');
    assert.equal(payload.nextGame.spread.line, 'UF -13.5');
    assert.equal(payload.nextGame.spread.uf, -13.5);
    assert.equal(payload.nextGame.total, 62.5);
    assert.equal(payload.nextGame.moneyline.uf, -550);
    assert.equal(payload.nextGame.moneyline.opp, 410);
    assert.equal(payload.lastGame.id, 'uf-missouri-2026-w5');
    assert.equal(payload.lastGame.homeScore, 17);
    assert.equal(payload.lastGame.awayScore, 45);
  });

  it('serves Texas as nextGame with UF +8.5 / 53.5 after the South Carolina hold', async () => {
    const when = new Date('2026-10-11T16:00:00.000Z');
    const next = pickNextGame(STATIC_LINES, when);
    assert.equal(next.id, 'uf-texas-2026-w7');
    const payload = await getBettingLines(when);
    assert.equal(payload.nextGame.id, 'uf-texas-2026-w7');
    assert.equal(payload.nextGame.spread.line, 'UF +8.5');
    assert.equal(payload.nextGame.spread.uf, 8.5);
    assert.equal(payload.nextGame.total, 53.5);
    assert.equal(payload.nextGame.moneyline.uf, 275);
    assert.equal(payload.nextGame.moneyline.opp, -345);
    assert.equal(payload.lastGame.id, 'uf-scar-2026-w6');
    assert.equal(payload.lastGame.homeScore, 19);
    assert.equal(payload.lastGame.awayScore, 38);
  });

  it('advances to Georgia after the Texas postgame window', () => {
    const next = pickNextGame(STATIC_LINES, new Date('2026-10-18T12:00:00.000Z'));
    assert.equal(next.id, 'uf-uga-2026-w9');
    const last = pickLastCompleted(STATIC_LINES, new Date('2026-10-18T12:00:00.000Z'));
    assert.equal(last.id, 'uf-texas-2026-w7');
  });

  it('serves Texas 27-24 as lastGame after the Texas hold', async () => {
    const payload = await getBettingLines(new Date('2026-10-18T12:00:00.000Z'));
    assert.equal(payload.nextGame.id, 'uf-uga-2026-w9');
    assert.equal(payload.lastGame.id, 'uf-texas-2026-w7');
    assert.equal(payload.lastGame.homeScore, 27);
    assert.equal(payload.lastGame.awayScore, 24);
    assert.equal(payload.finals['uf-texas-2026-w7'].uf, 27);
    assert.equal(payload.finals['uf-texas-2026-w7'].opp, 24);
  });

  it('serves Oklahoma as nextGame with UF -5.5 / 48.5 after the Georgia hold', async () => {
    const when = new Date('2026-11-01T20:00:00.000Z');
    const next = pickNextGame(STATIC_LINES, when);
    assert.equal(next.id, 'uf-oklahoma-2026-w10');
    const payload = await getBettingLines(when);
    assert.equal(payload.nextGame.id, 'uf-oklahoma-2026-w10');
    assert.equal(payload.nextGame.spread.line, 'UF -5.5');
    assert.equal(payload.nextGame.spread.uf, -5.5);
    assert.equal(payload.nextGame.total, 48.5);
    assert.equal(payload.nextGame.moneyline.uf, -205);
    assert.equal(payload.nextGame.moneyline.opp, 176);
    assert.equal(payload.lastGame.id, 'uf-uga-2026-w9');
    assert.equal(payload.lastGame.homeScore, 8);
    assert.equal(payload.lastGame.awayScore, 27);
    assert.equal(payload.finals['uf-uga-2026-w9'].uf, 8);
    assert.equal(payload.finals['uf-uga-2026-w9'].opp, 27);
  });

  it('does not invent a FanDuel -6.5 / 46.5 as the Oklahoma stamp', () => {
    const ou = STATIC_LINES.find((g) => g.id === 'uf-oklahoma-2026-w10');
    assert.ok(ou);
    assert.equal(ou.spread.line, 'UF -5.5');
    assert.equal(ou.total, 48.5);
    assert.notEqual(ou.spread.uf, -6.5);
    assert.notEqual(ou.total, 46.5);
  });

  it('serves Kentucky as nextGame after the Oklahoma hold, with no invented line', async () => {
    const when = new Date('2026-11-08T20:00:00.000Z');
    const next = pickNextGame(STATIC_LINES, when);
    assert.equal(next.id, 'uf-kentucky-2026-w11');
    const payload = await getBettingLines(when);
    assert.equal(payload.nextGame.id, 'uf-kentucky-2026-w11');
    assert.equal(payload.nextGame.spread, null);
    assert.equal(payload.nextGame.total, null);
    assert.equal(payload.nextGame.moneyline, null);
    assert.equal(payload.lastGame.id, 'uf-oklahoma-2026-w10');
    assert.equal(payload.lastGame.homeScore, 7);
    assert.equal(payload.lastGame.awayScore, 23);
    assert.equal(payload.finals['uf-oklahoma-2026-w10'].uf, 7);
    assert.equal(payload.finals['uf-oklahoma-2026-w10'].opp, 23);
  });
});
