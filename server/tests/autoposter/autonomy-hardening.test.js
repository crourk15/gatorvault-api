/** Autonomy hardening — cadence, fingerprints, golden-four priority. */
const test = require('node:test');
const assert = require('node:assert/strict');
const cadence = require('../../lib/x-autoposter-cadence');
const { stableIntelFingerprint, intelFingerprint } = require('../../lib/commit-fingerprint');

test('golden-four enqueue items classify as major_beat urgent', () => {
  const urgency = cadence.classifyItemUrgency({
    source: 'golden-four-enqueue',
    playerName: 'Bryce Willingham',
    validationMeta: { goldenFourEnqueue: true }
  });
  assert.equal(urgency.label, 'major_beat');
  assert.equal(urgency.tier, 'urgent');
});

test('stableIntelFingerprint does not rotate daily', () => {
  const a = stableIntelFingerprint('bryce-willingham', 'heat_mover');
  const b = stableIntelFingerprint('bryce-willingham', 'heat_mover');
  const daily = intelFingerprint('bryce-willingham', 'heat_mover', new Date().toISOString().slice(0, 10));
  assert.equal(a, b);
  assert.notEqual(a, daily);
});

test('first pending golden-four post allowed when lastPostAt is null', () => {
  const window = cadence.evaluatePostWindow({
    pendingItems: [
      {
        status: 'pending',
        scheduledAt: new Date(Date.now() - 60000).toISOString(),
        source: 'golden-four-enqueue',
        playerName: 'Bryce Willingham',
        validationMeta: { goldenFourEnqueue: true }
      }
    ],
    lastPostAt: null
  });
  assert.equal(window.allowed, true);
  assert.equal(window.reason, 'first_post');
});
