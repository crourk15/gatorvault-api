'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isPriorGameWeekNowPulse } = require('../../lib/elite-home-now');

const OLE_MISS_MONDAY = Date.parse('2026-09-21T18:00:00.000Z');

test('Campbell gameday pulse is off NOW after Campbell is final', () => {
  const line = 'Robinson — expected Campbell gameday (2nd UF visit, first Swamp game).';
  assert.equal(isPriorGameWeekNowPulse(line, { timestamp: '2026-09-11T23:10:00.000Z' }, OLE_MISS_MONDAY), true);
  assert.equal(
    isPriorGameWeekNowPulse('Cyion Smith — Florida visit', { timestamp: '2026-09-11T23:10:00.000Z' }, OLE_MISS_MONDAY),
    true
  );
});

test('this-week Ole Miss expected visitors stay on NOW', () => {
  assert.equal(
    isPriorGameWeekNowPulse('Expected visitors in the Swamp this Saturday', {}, OLE_MISS_MONDAY),
    false
  );
});
