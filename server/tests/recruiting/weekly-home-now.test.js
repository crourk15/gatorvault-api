'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildWeeklyHomeNowLines,
  buildWeeklyHomeNowCategories,
  seasonRecord,
} = require('../../lib/weekly-home-now');
const { getScheduleBoard } = require('../../lib/schedule-board');

test('Ole Miss week NOW is three pillars — Game owns ABC', () => {
  const now = new Date('2026-09-21T18:00:00.000Z');
  const lines = buildWeeklyHomeNowLines(now);
  assert.equal(lines.length, 3);
  assert.match(lines[0], /^Game — Ole Miss in the Swamp · ABC$/);
  assert.match(lines[1], /^Visitors — /);
  assert.doesNotMatch(lines[1], /ABC|in the Swamp/i);
  assert.match(lines[2], /^Season — 3-0 · first SEC home Saturday$/);
  assert.ok(!lines.some((s) => /class trending|#8|blue chip/i.test(s)));
});

test('Ole Miss week categories tick visitor names under Visitors, not ABC', () => {
  const cats = buildWeeklyHomeNowCategories(new Date('2026-09-21T18:00:00.000Z'));
  assert.equal(cats.length, 3);
  assert.equal(cats[0].label, 'Game');
  assert.ok(cats[0].items.some((s) => /ABC/i.test(s)));
  assert.equal(cats[1].label, 'Visitors');
  assert.ok(cats[1].items.length >= 3);
  assert.ok(cats[1].items.every((s) => !/ABC/i.test(s)));
  assert.equal(cats[2].label, 'Season');
  assert.match(cats[2].items[0], /3-0/);
});

test('season record after Auburn is 3-0', () => {
  const board = getScheduleBoard(2026);
  const rec = seasonRecord(new Date('2026-09-21T18:00:00.000Z'), board.games);
  assert.deepEqual(rec, { wins: 3, losses: 0 });
});

test('offseason has no weekly slate', () => {
  assert.deepEqual(buildWeeklyHomeNowLines(new Date('2026-07-15T16:00:00.000Z'), []), []);
  assert.deepEqual(buildWeeklyHomeNowCategories(new Date('2026-07-15T16:00:00.000Z'), []), []);
});
