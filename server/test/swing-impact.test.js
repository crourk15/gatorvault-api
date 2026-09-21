'use strict';

const assert = require('assert');
const { describe, it } = require('node:test');
const scheduleBoard = require('../lib/schedule-board');
const {
  computeSwingImpact,
  decorateBoardSwing,
  loadProductionBySlug,
  rbFormAdj,
  rushLook,
  swingSlug,
  weekForGame,
} = require('../lib/swing-impact');

describe('swing-impact', () => {
  it('maps Baugh aliases onto the roster slug', () => {
    assert.equal(swingSlug('Jadan Baugh'), 'jadan-baugh');
    assert.equal(swingSlug('Jaden Baugh'), 'jadan-baugh');
  });

  it('reads FAU 200 YPG as a soft rush look and Baylor 103 as stingy', () => {
    assert.deepEqual(rushLook('FAU allowed 200 rush YPG; Navy hit them for 397'), {
      allowed: 200,
      soft: true,
    });
    assert.deepEqual(rushLook('held Baylor to 103 rush'), { allowed: 103, soft: false });
    assert.deepEqual(rushLook('LSU ran for 172'), { allowed: 172, soft: true });
  });

  it('scores last official rush line without inventing a missing week', () => {
    assert.equal(
      rbFormAdj([{ week: 1, stats: { yds: 160, td: 3, car: 14 } }]),
      9
    );
    assert.equal(
      rbFormAdj([{ week: 2, stats: { yds: 136, td: 2, car: 14 } }]),
      7
    );
    assert.equal(rbFormAdj([]), 0);
  });

  it('weeks the 2026 slate FAU → Campbell → Auburn → Ole Miss', () => {
    const board = scheduleBoard.getScheduleBoard(2026);
    const week = (id) => weekForGame(board, board.games.find((g) => g.id === id));
    assert.equal(week('fau'), 1);
    assert.equal(week('campbell'), 2);
    assert.equal(week('auburn'), 3);
    assert.equal(week('olemiss'), 4);
  });

  it('moves Baugh from FAU opener through Ole Miss on official form + this front', () => {
    const board = scheduleBoard.getScheduleBoard(2026);
    const prod = loadProductionBySlug();
    const baugh = (id) =>
      computeSwingImpact(
        { name: 'Jadan Baugh', role: board.games.find((g) => g.id === id).swing.find((s) => /baugh/i.test(s.name)).role },
        board.games.find((g) => g.id === id),
        board,
        prod
      );
    const fau = baugh('fau');
    const campbell = baugh('campbell');
    const auburn = baugh('auburn');
    const olemiss = baugh('olemiss');
    assert.equal(fau.week, 1);
    assert.equal(fau.form, 0, 'FAU does not count the W1 box');
    assert.equal(fau.impact, 92);
    assert.equal(campbell.form, 9, 'W1 14-160-3 only');
    assert.equal(campbell.impact, 95);
    assert.equal(auburn.form, 7, 'W2 14-136-2; no invented Auburn line');
    assert.equal(auburn.impact, 93);
    assert.equal(olemiss.form, 7);
    assert.equal(olemiss.impact, 95);
    assert.equal(olemiss.trend, 'up');
  });

  it('decorates the live board without rewriting seed JSON stamps', () => {
    const board = scheduleBoard.getScheduleBoard(2026);
    const seed = board.games.find((g) => g.id === 'fau').swing.find((s) => /baugh/i.test(s.name));
    assert.equal(seed.impact, 95);
    const live = decorateBoardSwing(board).games.find((g) => g.id === 'fau').swing.find((s) => /baugh/i.test(s.name));
    assert.equal(live.impact, 92);
    assert.equal(live.trend, 'up');
  });
});
