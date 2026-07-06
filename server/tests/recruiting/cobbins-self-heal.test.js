/** Cobbins self-heal assessment — sub-elite resolution should flag needsHeal. */
const test = require('node:test');
const assert = require('node:assert/strict');

const { assessSelfHealCandidate } = require('../../lib/autoposter/elite-self-heal');
const resolutionLedger = require('../../lib/autoposter/player-resolution-ledger');

const SLUG = 'jermaine-cobbins';

test('assessSelfHealCandidate flags sub-elite prior send for Cobbins', async () => {
  resolutionLedger.markResolvedPublish(SLUG, {
    preview: '2028 ATH Jermaine Cobbins\nFlorida DB tradition pitch...',
    intelFingerprint: 'on3_news_test_cobbins'
  });

  const out = await assessSelfHealCandidate(SLUG, {
    refreshOn3: false,
    _testSkipRefresh: true,
    persistFusion: false
  });

  assert.equal(out.tier === 'A' || out.tier === 'B', true);
  assert.equal(out.needsHeal, true);
  assert.equal(out.healReason, 'sub_elite_prior_send');
  assert.equal(out.current?.fingerprint?.ok, true);
  assert.match(out.current?.probe?.identity || '', /On3 No\.\s*\d+\s*natl/i);

  resolutionLedger.clearPlayerResolution(SLUG);
});
