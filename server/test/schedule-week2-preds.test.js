'use strict';

const assert = require('assert');
const { describe, it } = require('node:test');
const scheduleBoard = require('../lib/schedule-board');

/** Week 2 remaining-season board — restamp after each Saturday from how teams looked. */
const WEEK2_REMAINING = {
  auburn: { ufPct: 51, pred: 'UF 27 · Auburn 23', predUF: 27, predOpp: 23 },
  olemiss: { ufPct: 47, pred: 'UF 24 · Ole Miss 28', predUF: 24, predOpp: 28 },
  missouri: { ufPct: 46, pred: 'UF 23 · Missouri 28', predUF: 23, predOpp: 28 },
  scar: { ufPct: 66, pred: 'UF 28 · South Carolina 17', predUF: 28, predOpp: 17 },
  texas: { ufPct: 34, pred: 'UF 17 · Texas 31', predUF: 17, predOpp: 31 },
  uga: { ufPct: 36, pred: 'UF 17 · Georgia 28', predUF: 17, predOpp: 28 },
  oklahoma: { ufPct: 54, pred: 'UF 27 · Oklahoma 24', predUF: 27, predOpp: 24 },
  kentucky: { ufPct: 58, pred: 'UF 27 · Kentucky 21', predUF: 27, predOpp: 21 },
  vandy: { ufPct: 69, pred: 'UF 28 · Vanderbilt 21', predUF: 28, predOpp: 21 },
  fsu: { ufPct: 60, pred: 'UF 28 · FSU 24', predUF: 28, predOpp: 24 },
};

describe('schedule remaining-season predictions (2026-W2)', () => {
  it('serves Week 2 restamp on remaining games and leaves Auburn film sit', () => {
    const payload = scheduleBoard.toApiPayload();
    assert.equal(payload.predThrough, '2026-W2');
    for (const [id, expected] of Object.entries(WEEK2_REMAINING)) {
      const game = payload.games.find((g) => g.id === id);
      assert.ok(game, `missing ${id}`);
      assert.equal(game.ufPct, expected.ufPct, `${id} ufPct`);
      assert.equal(game.pred, expected.pred, `${id} pred`);
      assert.equal(game.predUF, expected.predUF, `${id} predUF`);
      assert.equal(game.predOpp, expected.predOpp, `${id} predOpp`);
    }
  });

  it('does not flip Texas or Georgia to a UF win off Week 1–2 tape', () => {
    const payload = scheduleBoard.toApiPayload();
    const texas = payload.games.find((g) => g.id === 'texas');
    const uga = payload.games.find((g) => g.id === 'uga');
    assert.ok(texas.predUF < texas.predOpp);
    assert.ok(uga.predUF < uga.predOpp);
    assert.ok(texas.ufPct < 40);
    assert.ok(uga.ufPct < 40);
  });
});
