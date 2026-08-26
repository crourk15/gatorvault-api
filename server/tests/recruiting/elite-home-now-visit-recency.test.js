'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isFreshHomeNowVisit,
  isVisitPulseSummary,
  HOME_NOW_VISIT_MAX_AGE_MS,
  HOME_NOW_MAX_AGE_MS,
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
  // Fresh reporting without a visit day still counts (≤3 weeks).
  assert.equal(isFreshHomeNowVisit({ reportedAt: '2026-08-14T00:12:49.325Z' }, now), true);
  // Reporting older than 3 weeks does not.
  assert.equal(isFreshHomeNowVisit({ reportedAt: '2026-07-01T00:00:00.000Z' }, now), false);
  assert.equal(isFreshHomeNowVisit({}, now), false);
  assert.ok(isVisitPulseSummary('unofficial visit · Florida'));
  assert.equal(HOME_NOW_VISIT_MAX_AGE_MS, HOME_NOW_MAX_AGE_MS);
  assert.ok(HOME_NOW_MAX_AGE_MS === 21 * 24 * 60 * 60 * 1000);
});
