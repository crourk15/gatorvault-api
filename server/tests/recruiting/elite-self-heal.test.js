/** Elite build fingerprint + self-heal assessment tests. */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  fingerprintFromEliteResult,
  eliteFingerprintDrift,
  isSubElitePreview,
  hashElitePayload,
  payloadFromEliteResult
} = require('../../lib/autoposter/elite-build-fingerprint');
const {
  recordEliteFingerprint,
  getEliteFingerprint
} = require('../../lib/autoposter/elite-fingerprint-ledger');

const eliteResult = {
  validationMeta: {
    composePath: 'elite_pr789',
    compositeScore: 85,
    dominantAngle: 'program_pitch',
    pr789AngleLive: true,
    rankingTokens: { on3Stars: 4, on3NationalRank: 28, on3PositionRank: 4, on3StateRank: 1 },
    scoutingRefresh: { refreshedAt: '2026-07-06T00:00:00.000Z', rankingValid: true }
  },
  templateBlocks: {
    identity: '2028 CB Jermaine Cobbins · 4★ · On3 No. 28 natl · No. 4 CB · No. 1 TN'
  }
};

test('fingerprintFromEliteResult produces stable elite hash', () => {
  const a = fingerprintFromEliteResult(eliteResult);
  const b = fingerprintFromEliteResult(eliteResult);
  assert.equal(a.ok, true);
  assert.equal(a.hash, b.hash);
  assert.match(a.hash, /^[a-f0-9]{24}$/);
});

test('eliteFingerprintDrift detects ranking changes', () => {
  const stored = fingerprintFromEliteResult(eliteResult);
  const changed = fingerprintFromEliteResult({
    ...eliteResult,
    validationMeta: {
      ...eliteResult.validationMeta,
      rankingTokens: { on3Stars: 4, on3NationalRank: 20, on3PositionRank: 4, on3StateRank: 1 }
    }
  });
  const drift = eliteFingerprintDrift(stored, changed);
  assert.equal(drift.drift, true);
  assert.equal(drift.reason, 'rankings_changed');
});

test('isSubElitePreview flags missing ranking suffix', () => {
  assert.equal(isSubElitePreview('2028 ATH Jermaine Cobbins\nFlorida DB tradition...'), true);
  assert.equal(isSubElitePreview('2028 CB Test · 4★ · On3 No. 28 natl · No. 4 CB · No. 1 TN'), false);
});

test('elite fingerprint ledger records and reads slug fingerprint', () => {
  const fp = fingerprintFromEliteResult(eliteResult);
  recordEliteFingerprint('test-player-self-heal', fp, { source: 'test' });
  const stored = getEliteFingerprint('test-player-self-heal');
  assert.equal(stored.hash, fp.hash);
  assert.equal(stored.payload.composePath, 'elite_pr789');
});

test('hashElitePayload is order-independent', () => {
  const payload = payloadFromEliteResult(eliteResult);
  const reversed = JSON.parse(JSON.stringify(payload));
  assert.equal(hashElitePayload(payload), hashElitePayload(reversed));
});
