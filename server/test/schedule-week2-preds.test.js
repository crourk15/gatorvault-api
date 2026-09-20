'use strict';

const assert = require('assert');
const { describe, it } = require('node:test');
const scheduleBoard = require('../lib/schedule-board');

/** Week 3 remaining-season board — restamp after Auburn from how teams looked. */
const WEEK3_REMAINING = {
  olemiss: { ufPct: 51, pred: 'UF 28 · Ole Miss 27', predUF: 28, predOpp: 27 },
  missouri: { ufPct: 48, pred: 'UF 24 · Missouri 27', predUF: 24, predOpp: 27 },
  scar: { ufPct: 68, pred: 'UF 31 · South Carolina 20', predUF: 31, predOpp: 20 },
  texas: { ufPct: 36, pred: 'UF 20 · Texas 31', predUF: 20, predOpp: 31 },
  uga: { ufPct: 37, pred: 'UF 20 · Georgia 28', predUF: 20, predOpp: 28 },
  oklahoma: { ufPct: 57, pred: 'UF 28 · Oklahoma 24', predUF: 28, predOpp: 24 },
  kentucky: { ufPct: 56, pred: 'UF 27 · Kentucky 24', predUF: 27, predOpp: 24 },
  vandy: { ufPct: 68, pred: 'UF 28 · Vanderbilt 24', predUF: 28, predOpp: 24 },
  fsu: { ufPct: 63, pred: 'UF 30 · FSU 24', predUF: 30, predOpp: 24 },
};

describe('schedule remaining-season predictions (2026-W3)', () => {
  it('serves Week 3 restamp on remaining games after the Auburn final', () => {
    const payload = scheduleBoard.toApiPayload();
    assert.equal(payload.predThrough, '2026-W3');
    assert.equal(payload.currentGameId, 'olemiss');
    const auburn = payload.games.find((g) => g.id === 'auburn');
    assert.equal(auburn.finalUF, 44);
    assert.equal(auburn.finalOpp, 39);
    for (const [id, expected] of Object.entries(WEEK3_REMAINING)) {
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
