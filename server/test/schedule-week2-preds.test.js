'use strict';

const assert = require('assert');
const { describe, it } = require('node:test');
const scheduleBoard = require('../lib/schedule-board');

/** Week 6 remaining-season board — scoring form after five official finals. */
const WEEK6_REMAINING = {
  scar: { ufPct: 73, pred: 'UF 32 · South Carolina 21', predUF: 32, predOpp: 21 },
  texas: { ufPct: 25, pred: 'UF 22 · Texas 34', predUF: 22, predOpp: 34 },
  uga: { ufPct: 31, pred: 'UF 23 · Georgia 32', predUF: 23, predOpp: 32 },
  oklahoma: { ufPct: 63, pred: 'UF 33 · Oklahoma 27', predUF: 33, predOpp: 27 },
  kentucky: { ufPct: 63, pred: 'UF 29 · Kentucky 23', predUF: 29, predOpp: 23 },
  vandy: { ufPct: 71, pred: 'UF 32 · Vanderbilt 22', predUF: 32, predOpp: 22 },
  fsu: { ufPct: 63, pred: 'UF 30 · FSU 24', predUF: 30, predOpp: 24 },
};

describe('schedule remaining-season predictions (2026-W6)', () => {
  it('serves Week 6 form restamp on remaining games after Missouri 17-45', () => {
    const payload = scheduleBoard.toApiPayload();
    assert.equal(payload.predThrough, '2026-W6');
    assert.equal(payload.currentGameId, 'scar');
    const missouri = payload.games.find((g) => g.id === 'missouri');
    assert.equal(missouri.finalUF, 17);
    assert.equal(missouri.finalOpp, 45);
    for (const [id, expected] of Object.entries(WEEK6_REMAINING)) {
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
