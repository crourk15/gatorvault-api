'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isFreshHomeNowOffer,
  isOfferPulseSummary,
  rankEliteHomeNowLines,
  HOME_NOW_OFFER_MAX_AGE_MS,
  HOME_NOW_MAX_AGE_MS,
} = require('../../lib/elite-home-now');

test('Florida offer must be a real offer day within 3 weeks', () => {
  const now = Date.parse('2026-08-26T18:00:00.000Z');
  assert.equal(
    isFreshHomeNowOffer(
      { offerDate: '2026-04-01', reportedAt: '2026-08-26T11:00:00.000Z' },
      now
    ),
    false
  );
  assert.equal(
    isFreshHomeNowOffer(
      { date: '2026-08-10', reportedAt: '2026-08-26T11:00:00.000Z' },
      now
    ),
    true
  );
  // 22 days old — off NOW.
  assert.equal(isFreshHomeNowOffer({ offerDate: '2026-08-04' }, now), false);
  // Rematerialization alone never counts.
  assert.equal(isFreshHomeNowOffer({ reportedAt: '2026-08-26T11:00:00.000Z' }, now), false);
  assert.equal(isFreshHomeNowOffer({}, now), false);
  assert.ok(isOfferPulseSummary('Florida offer'));
  assert.equal(HOME_NOW_OFFER_MAX_AGE_MS, HOME_NOW_MAX_AGE_MS);
  assert.ok(HOME_NOW_MAX_AGE_MS === 21 * 24 * 60 * 60 * 1000);
});

test('rival-only offers never rank into Home NOW', () => {
  const lines = rankEliteHomeNowLines(
    [
      'Landon Dawson — Offer from Connecticut Huskies',
      'Malakhi Dudley — Offer from Nebraska',
      'Ryan Drakeford — Visit scheduled (Sept)',
      '2027 class trending nationally — UF at #8',
    ],
    6
  );
  assert.ok(!lines.some((l) => /Offer from/i.test(l)));
  assert.ok(lines.some((l) => /Visit scheduled/i.test(l)));
});
