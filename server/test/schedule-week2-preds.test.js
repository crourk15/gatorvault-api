'use strict';

const assert = require('assert');
const { describe, it } = require('node:test');
const scheduleBoard = require('../lib/schedule-board');

/** Week 8 form overlay after Georgia 8-27 (season 35.6 PPG). */
const WEEK8_REMAINING = {
  oklahoma: { ufPct: 50, pred: 'UF 27 · Oklahoma 27', predUF: 27, predOpp: 27 },
  kentucky: { ufPct: 52, pred: 'UF 24 · Kentucky 23', predUF: 24, predOpp: 23 },
  vandy: { ufPct: 58, pred: 'UF 26 · Vanderbilt 22', predUF: 26, predOpp: 22 },
  fsu: { ufPct: 50, pred: 'UF 24 · FSU 24', predUF: 24, predOpp: 24 },
};

describe('schedule remaining-season predictions (2026-W8)', () => {
  it('keeps Week 8 form on remaining games after Georgia 8-27', () => {
    const payload = scheduleBoard.toApiPayload();
    assert.equal(payload.predThrough, '2026-W8');
    assert.equal(payload.currentGameId, 'oklahoma');
    const uga = payload.games.find((g) => g.id === 'uga');
    assert.equal(uga.finalUF, 8);
    assert.equal(uga.finalOpp, 27);
    assert.equal(uga.pred, 'UF 23 · Georgia 32');
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
    for (const [id, expected] of Object.entries(WEEK8_REMAINING)) {
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
