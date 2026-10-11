'use strict';

const assert = require('assert');
const { describe, it } = require('node:test');
const scheduleBoard = require('../lib/schedule-board');

/** Week 7 remaining-season board — scoring form after South Carolina 19-38. */
const WEEK7_REMAINING = {
  texas: { ufPct: 22, pred: 'UF 20 · Texas 34', predUF: 20, predOpp: 34 },
  uga: { ufPct: 27, pred: 'UF 21 · Georgia 32', predUF: 21, predOpp: 32 },
  oklahoma: { ufPct: 56, pred: 'UF 30 · Oklahoma 27', predUF: 30, predOpp: 27 },
  kentucky: { ufPct: 58, pred: 'UF 27 · Kentucky 23', predUF: 27, predOpp: 23 },
  vandy: { ufPct: 65, pred: 'UF 29 · Vanderbilt 22', predUF: 29, predOpp: 22 },
  fsu: { ufPct: 56, pred: 'UF 27 · FSU 24', predUF: 27, predOpp: 24 },
};

describe('schedule remaining-season predictions (2026-W7)', () => {
  it('serves Week 7 form restamp on remaining games after South Carolina 19-38', () => {
    const payload = scheduleBoard.toApiPayload();
    assert.equal(payload.predThrough, '2026-W7');
    assert.equal(payload.currentGameId, 'texas');
    const scar = payload.games.find((g) => g.id === 'scar');
    assert.equal(scar.finalUF, 19);
    assert.equal(scar.finalOpp, 38);
    assert.equal(scar.pred, 'UF 32 · South Carolina 21');
    assert.equal(scar.ufPct, 73);
    const missouri = payload.games.find((g) => g.id === 'missouri');
    assert.equal(missouri.finalUF, 17);
    assert.equal(missouri.finalOpp, 45);
    for (const [id, expected] of Object.entries(WEEK7_REMAINING)) {
      const game = payload.games.find((g) => g.id === id);
      assert.ok(game, `missing ${id}`);
      assert.equal(game.ufPct, expected.ufPct, `${id} ufPct`);
      assert.equal(game.pred, expected.pred, `${id} pred`);
      assert.equal(game.predUF, expected.predUF, `${id} predUF`);
      assert.equal(game.predOpp, expected.predOpp, `${id} predOpp`);
    }
  });

  it('does not flip Texas or Georgia to a UF win off Week 1–3 tape', () => {
    const payload = scheduleBoard.toApiPayload();
    const texas = payload.games.find((g) => g.id === 'texas');
    const uga = payload.games.find((g) => g.id === 'uga');
    assert.ok(texas.predUF < texas.predOpp);
    assert.ok(uga.predUF < uga.predOpp);
    assert.ok(texas.ufPct < 40);
    assert.ok(uga.ufPct < 40);
  });
});
