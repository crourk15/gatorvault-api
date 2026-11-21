'use strict';

const assert = require('assert');
const { describe, it } = require('node:test');
const scheduleBoard = require('../lib/schedule-board');

/** Week 11 remaining card after Vanderbilt 34-27. */
const WEEK11_REMAINING = {
  fsu: { ufPct: 58, pred: 'UF 27 · FSU 23', predUF: 27, predOpp: 23 },
};

describe('schedule remaining-season predictions (2026-W11)', () => {
  it('keeps the sat FSU card after Vanderbilt 34-27', () => {
    const payload = scheduleBoard.toApiPayload();
    assert.equal(payload.predThrough, '2026-W11');
    assert.equal(payload.currentGameId, 'fsu');
    const uga = payload.games.find((g) => g.id === 'uga');
    assert.equal(uga.finalUF, 8);
    assert.equal(uga.finalOpp, 27);
    assert.equal(uga.pred, 'UF 23 · Georgia 32');
    const oklahoma = payload.games.find((g) => g.id === 'oklahoma');
    assert.equal(oklahoma.finalUF, 7);
    assert.equal(oklahoma.finalOpp, 23);
    assert.equal(oklahoma.pred, 'UF 27 · Oklahoma 24');
    assert.equal(oklahoma.predSat, true);
    const texas = payload.games.find((g) => g.id === 'texas');
    assert.equal(texas.finalUF, 27);
    assert.equal(texas.finalOpp, 24);
    assert.equal(texas.pred, 'UF 22 · Texas 34');
    const scar = payload.games.find((g) => g.id === 'scar');
    assert.equal(scar.finalUF, 19);
    assert.equal(scar.finalOpp, 38);
    assert.equal(scar.pred, 'UF 32 · South Carolina 21');
    assert.equal(scar.ufPct, 73);
    const missouri = payload.games.find((g) => g.id === 'missouri');
    assert.equal(missouri.finalUF, 17);
    assert.equal(missouri.finalOpp, 45);
    const kentucky = payload.games.find((g) => g.id === 'kentucky');
    assert.equal(kentucky.finalUF, 21);
    assert.equal(kentucky.finalOpp, 14);
    assert.equal(kentucky.pred, 'UF 22 · Kentucky 23');
    const vandy = payload.games.find((g) => g.id === 'vandy');
    assert.equal(vandy.finalUF, 34);
    assert.equal(vandy.finalOpp, 27);
    assert.equal(vandy.pred, 'UF 24 · Vanderbilt 17');
    for (const [id, expected] of Object.entries(WEEK11_REMAINING)) {
      const game = payload.games.find((g) => g.id === id);
      assert.ok(game, `missing ${id}`);
      assert.equal(game.ufPct, expected.ufPct, `${id} ufPct`);
      assert.equal(game.pred, expected.pred, `${id} pred`);
      assert.equal(game.predUF, expected.predUF, `${id} predUF`);
      assert.equal(game.predOpp, expected.predOpp, `${id} predOpp`);
    }
  });

  it('does not flip Georgia to a UF win off the Texas result', () => {
    const payload = scheduleBoard.toApiPayload();
    const uga = payload.games.find((g) => g.id === 'uga');
    assert.ok(uga.predUF < uga.predOpp);
    assert.ok(uga.ufPct < 40);
  });
});
