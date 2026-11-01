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
  n: 8,
  ufPpg: (66 + 52 + 44 + 52 + 17 + 19 + 27 + 8) / 8,
  allowed: (21 + 3 + 39 + 28 + 45 + 38 + 24 + 27) / 8,
};

describe('schedule form predictions', () => {
  it('reads 35.6 PPG from the official 2026 finals after Georgia', () => {
    const board = scheduleBoard.getScheduleBoard(2026);
    const form = measureUfScoringForm(board.games);
    assert.equal(form.n, 8);
    assert.equal(form.ufPpg, FORM_2026.ufPpg);
    assert.ok(form.ufPpg < 40, 'Georgia 8 pulls season scoring off the Texas-week 30s');
  });

  it('regresses pace so remaining cards are not 50 every week', () => {
    const pace = blendedUfPace(FORM_2026.ufPpg);
    assert.ok(pace < FORM_2026.ufPpg);
    assert.ok(pace > 30);
    assert.ok(pace < 40);
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

  it('does not overwrite a sat Oklahoma GatorVault prediction', () => {
    const payload = scheduleBoard.toApiPayload();
    const oklahoma = payload.games.find((g) => g.id === 'oklahoma');
    assert.equal(oklahoma.ufPct, 50);
    assert.equal(oklahoma.pred, 'UF 27 · Oklahoma 24');
    assert.equal(oklahoma.predUF, 27);
    assert.equal(oklahoma.predOpp, 24);
    const locked = applyFormPredictions({
      games: [
        { id: 'fau', finalUF: 66, finalOpp: 21 },
        { id: 'campbell', finalUF: 52, finalOpp: 3 },
        { id: 'auburn', finalUF: 44, finalOpp: 39 },
        {
          id: 'oklahoma',
          predSat: true,
          predUF: 27,
          predOpp: 24,
          ufPct: 50,
          pred: 'UF 27 · Oklahoma 24',
          venue: 'Ben Hill Griffin Stadium, Gainesville FL',
        },
      ],
    });
    const ou = locked.games.find((g) => g.id === 'oklahoma');
    assert.equal(ou.pred, 'UF 27 · Oklahoma 24');
    assert.equal(ou.ufPct, 50);
    assert.equal(ou.predUF, 27);
    assert.equal(ou.predOpp, 24);
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
