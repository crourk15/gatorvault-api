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
    isDeskOpsIntelCopy('Kaleb Ballard — Florida offer on file. Continuous allowlist intel sweep.'),
    true,
  );
  assert.equal(isDeskOpsIntelCopy('Staff note — Sumrall staff is cooking'), true);
  assert.equal(isDeskOpsIntelCopy('Tranard Roberts — unofficial visit · Florida'), false);
});

test('fan rewrite salvages offer facts and drops staff notes', () => {
  assert.equal(
    toFanFacingIntelDetail('Gionni Lewis — Florida offer from player card.', {
      eventType: 'offer',
      playerName: 'Gionni Lewis',
    }),
    'Gionni Lewis — Florida offer',
  );
  assert.equal(
    toFanFacingIntelDetail('Continuous allowlist intel sweep · Florida offer', {
      eventType: 'offer',
      playerName: 'Kaleb Ballard',
    }),
    'Kaleb Ballard — Florida offer',
  );
  assert.equal(
    toFanFacingIntelDetail('Internal staff push detail', { eventType: 'staff_note' }),
    null,
  );
  assert.equal(toFanFacingHubSummary('Staff note — Brandon Harris cooking', {}), null);
  assert.equal(
    toFanFacingHubSummary('unofficial visit · Florida', { eventType: 'visit' }),
    'unofficial visit · Florida',
  );
});
