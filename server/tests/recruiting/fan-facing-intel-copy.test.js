'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isDeskOpsIntelCopy,
  toFanFacingIntelDetail,
  toFanFacingHubSummary,
} = require('../../lib/fan-facing-intel-copy');

test('desk ops copy is detected', () => {
  assert.equal(isDeskOpsIntelCopy('Gionni Lewis — Florida offer from player card.'), true);
  assert.equal(
    isDeskOpsIntelCopy('Antijuan Wilkes Jr. — Florida offer on file (2026-08-26).'),
    true,
  );
  assert.equal(isDeskOpsIntelCopy('Staff note — Sumrall staff is cooking'), true);
  assert.equal(isDeskOpsIntelCopy('Tranard Roberts — unofficial visit · Florida'), false);
});

test('fan rewrite salvages offer facts and drops staff notes', () => {
  assert.equal(
    toFanFacingIntelDetail('Antijuan Wilkes Jr. — Florida offer on file (2026-08-26).', {
      eventType: 'offer',
      playerName: 'Antijuan Wilkes Jr.',
    }),
    'Antijuan Wilkes Jr. — Florida offer',
  );
  assert.equal(
    toFanFacingIntelDetail('Gionni Lewis — Florida offer from player card.', {
      eventType: 'offer',
      playerName: 'Gionni Lewis',
    }),
    'Gionni Lewis — Florida offer',
  );
  assert.equal(
    toFanFacingIntelDetail('Internal staff push detail', { eventType: 'staff_note' }),
    null,
  );
  assert.equal(toFanFacingHubSummary('Staff note — Brandon Harris cooking', {}), null);
  assert.equal(toFanFacingHubSummary('Offer from Florida', { eventType: 'offer' }), 'Florida offer');
  assert.equal(
    toFanFacingHubSummary('unofficial visit · Florida', { eventType: 'visit' }),
    'unofficial visit · Florida',
  );
});

test('article prose compresses to finished Florida visit chips (no mid-word …)', () => {
  const dion =
    "Four-star 2028 ATH Dion Edwards has not been on Florida's campus yet. That will change this fall, as he's set to visit the Swamp along wi…";
  assert.equal(
    toFanFacingIntelDetail(dion, { eventType: 'visit', playerName: 'Dion Edwards' }),
    'Dion Edwards — Florida visit this fall',
  );
  const ryan =
    "NEW: 2028 S Ryan Drakeford tells @Swamp_247 he plans to visit Florida along with 13 other programs this fall. He'll be on campus for Flor…";
  assert.equal(
    toFanFacingIntelDetail(ryan, { eventType: 'visit', playerName: 'Ryan Drakeford' }),
    'Ryan Drakeford — Florida visit this fall',
  );
  const out = toFanFacingIntelDetail(dion, { eventType: 'visit', playerName: 'Dion Edwards' });
  assert.ok(out && !/[…]|\.{3}/.test(out));
  assert.ok(!/along wi/i.test(out));
});

