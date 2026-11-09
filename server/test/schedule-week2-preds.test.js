'use strict';

const assert = require('assert');
const { describe, it } = require('node:test');
const scheduleBoard = require('../lib/schedule-board');

/** Week 9 form overlay after Oklahoma 7-23. */
const WEEK9_REMAINING = {
  kentucky: { ufPct: 48, pred: 'UF 22 · Kentucky 23', predUF: 22, predOpp: 23 },
  vandy: { ufPct: 54, pred: 'UF 24 · Vanderbilt 22', predUF: 24, predOpp: 22 },
  fsu: { ufPct: 48, pred: 'UF 23 · FSU 24', predUF: 23, predOpp: 24 },
};

describe('schedule remaining-season predictions (2026-W9)', () => {
  it('keeps Week 9 form on remaining games after Oklahoma 7-23', () => {
    const payload = scheduleBoard.toApiPayload();
    assert.equal(payload.predThrough, '2026-W9');
    assert.equal(payload.currentGameId, 'kentucky');
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
    for (const [id, expected] of Object.entries(WEEK9_REMAINING)) {
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
