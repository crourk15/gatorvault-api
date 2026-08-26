'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isFreshHomeNowVisit,
  isVisitPulseSummary,
  HOME_NOW_VISIT_MAX_AGE_MS,
} = require('../../lib/elite-home-now');

test('stale Tranard-style UOV is not Home NOW fresh', () => {
  const now = Date.parse('2026-08-26T18:00:00.000Z');
  assert.equal(
    isFreshHomeNowVisit(
      { visitDate: '2026-04-11', reportedAt: '2026-08-14T00:12:49.325Z' },
      now
    ),
    false
  );
  assert.equal(
    isFreshHomeNowVisit(
      { visitDate: '2026-08-20', reportedAt: '2026-08-26T11:00:00.000Z' },
      now
    ),
    true
  );
  assert.equal(isFreshHomeNowVisit({ reportedAt: '2026-08-14T00:12:49.325Z' }, now), true);
  // Undated history never paints as NOW.
  assert.equal(isFreshHomeNowVisit({}, now), false);
  assert.ok(isVisitPulseSummary('unofficial visit · Florida'));
  assert.ok(HOME_NOW_VISIT_MAX_AGE_MS === 21 * 24 * 60 * 60 * 1000);
});
