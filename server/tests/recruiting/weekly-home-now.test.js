'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildWeeklyHomeNowLines, seasonRecord } = require('../../lib/weekly-home-now');
const { getScheduleBoard } = require('../../lib/schedule-board');

test('Ole Miss week NOW is three weekly lines, not class rank', () => {
  const lines = buildWeeklyHomeNowLines(new Date('2026-09-21T18:00:00.000Z'));
  assert.equal(lines.length, 3);
  assert.equal(lines[0], 'Game Week — Ole Miss in the Swamp · ABC');
  assert.equal(lines[1], 'Expected visitors in the Swamp this Saturday');
  assert.equal(lines[2], '3-0 — first SEC home Saturday');
  assert.ok(!lines.some((s) => /class trending|#8|Blue chip/i.test(s)));
});

test('season record after Auburn is 3-0', () => {
  const board = getScheduleBoard(2026);
  const rec = seasonRecord(new Date('2026-09-21T18:00:00.000Z'), board.games);
  assert.deepEqual(rec, { wins: 3, losses: 0 });
});

test('offseason has no weekly slate', () => {
  assert.deepEqual(buildWeeklyHomeNowLines(new Date('2026-07-15T16:00:00.000Z')), []);
});
