'use strict';

const assert = require('assert');
const { describe, it } = require('node:test');
const scheduleBoard = require('../lib/schedule-board');

/** Week 5 remaining-season board — scoring form after four official finals. */
const WEEK5_REMAINING = {
  missouri: { ufPct: 71, pred: 'UF 34 · Missouri 24', predUF: 34, predOpp: 24 },
  scar: { ufPct: 82, pred: 'UF 36 · South Carolina 21', predUF: 36, predOpp: 21 },
  texas: { ufPct: 31, pred: 'UF 25 · Texas 34', predUF: 25, predOpp: 34 },
  uga: { ufPct: 37, pred: 'UF 26 · Georgia 32', predUF: 26, predOpp: 32 },
  oklahoma: { ufPct: 71, pred: 'UF 37 · Oklahoma 27', predUF: 37, predOpp: 27 },
  kentucky: { ufPct: 71, pred: 'UF 33 · Kentucky 23', predUF: 33, predOpp: 23 },
  vandy: { ufPct: 79, pred: 'UF 36 · Vanderbilt 22', predUF: 36, predOpp: 22 },
  fsu: { ufPct: 71, pred: 'UF 34 · FSU 24', predUF: 34, predOpp: 24 },
};

describe('schedule remaining-season predictions (2026-W5)', () => {
  it('serves Week 5 form restamp on remaining games (53.5 PPG, not 28–21)', () => {
    const payload = scheduleBoard.toApiPayload();
    assert.equal(payload.predThrough, '2026-W5');
    assert.equal(payload.currentGameId, 'missouri');
    const olemiss = payload.games.find((g) => g.id === 'olemiss');
    assert.equal(olemiss.finalUF, 52);
    assert.equal(olemiss.finalOpp, 28);
    for (const [id, expected] of Object.entries(WEEK5_REMAINING)) {
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
