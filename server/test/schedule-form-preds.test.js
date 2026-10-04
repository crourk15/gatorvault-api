'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const {
  measureUfScoringForm,
  blendedUfPace,
  projectRemainingGame,
  applyFormPredictions,
} = require('../lib/schedule-form-preds');
const scheduleBoard = require('../lib/schedule-board');

const FORM_2026_W5 = {
  n: 4,
  ufPpg: (66 + 52 + 44 + 52) / 4,
  allowed: (21 + 3 + 39 + 28) / 4,
};

const FORM_2026 = {
  n: 5,
  ufPpg: (66 + 52 + 44 + 52 + 17) / 5,
  allowed: (21 + 3 + 39 + 28 + 45) / 5,
};

describe('schedule form predictions', () => {
  it('reads 46.2 PPG from the official 2026 finals after Missouri', () => {
    const board = scheduleBoard.getScheduleBoard(2026);
    const form = measureUfScoringForm(board.games);
    assert.equal(form.n, 5);
    assert.equal(form.ufPpg, FORM_2026.ufPpg);
    assert.ok(form.ufPpg < 50, 'Missouri 17 pulls season scoring off 50+');
  });

  it('regresses pace so remaining cards are not 50 every week', () => {
    const pace = blendedUfPace(FORM_2026.ufPpg);
    assert.ok(pace < FORM_2026.ufPpg);
    assert.ok(pace > 40);
    assert.ok(pace < 50);
  });

  it('Missouri is a 30s road win, not 28-21', () => {
    const next = projectRemainingGame(
      { id: 'missouri', venue: 'Faurot Field, Columbia MO' },
      FORM_2026_W5
    );
    assert.ok(next);
    assert.ok(next.predUF >= 33 && next.predUF <= 38, `predUF ${next.predUF}`);
    assert.ok(next.predOpp >= 21 && next.predOpp <= 27, `predOpp ${next.predOpp}`);
    assert.ok(next.predUF > next.predOpp);
    assert.ok(next.ufPct >= 68, `ufPct ${next.ufPct}`);
    assert.match(next.pred, /Missouri/);
  });

  it('does not flip Texas or Georgia off scoring form', () => {
    const texas = projectRemainingGame(
      { id: 'texas', venue: 'DKR-Texas Memorial Stadium, Austin TX' },
      FORM_2026
    );
    const uga = projectRemainingGame(
      { id: 'uga', venue: 'Mercedes-Benz Stadium, Atlanta GA' },
      FORM_2026
    );
    assert.ok(texas.predUF < texas.predOpp);
    assert.ok(uga.predUF < uga.predOpp);
    assert.ok(texas.ufPct < 40);
    assert.ok(uga.ufPct < 40);
  });

  it('heals a stale 28-21 Missouri stamp on the live board', () => {
    const payload = scheduleBoard.toApiPayload();
    const missouri = payload.games.find((g) => g.id === 'missouri');
    assert.ok(missouri.predUF >= 33);
    assert.notEqual(missouri.pred, 'UF 28 \u00b7 Missouri 21');
    assert.ok(missouri.ufPct > 65);
    const olemiss = payload.games.find((g) => g.id === 'olemiss');
    assert.equal(olemiss.pred, 'UF 28 \u00b7 Ole Miss 27');
    assert.equal(olemiss.finalUF, 52);
  });

  it('skips overlay when there are not enough finals', () => {
    const doc = {
      games: [
        { id: 'missouri', predUF: 28, predOpp: 21, ufPct: 65, pred: 'UF 28 \u00b7 Missouri 21' },
      ],
    };
    assert.equal(applyFormPredictions(doc), doc);
  });
});
