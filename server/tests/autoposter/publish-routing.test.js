/** Publish routing — PR-789 → PR-6 → fail closed (no strategy v2 templates). */
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.X_DISABLE_TEMPLATES = 'true';
process.env.X_AUTOPOST_PR6_ENABLED = 'true';

const { resolvePublishText, isTemplatesPublishDisabled } = require('../../lib/autoposter/publish-routing');

test('templates publish disabled by default', () => {
  assert.equal(isTemplatesPublishDisabled(), true);
});

test('prefers PR-789 angle over PR-6', () => {
  const out = resolvePublishText({}, 'BAD TEMPLATE face time line', {
    pr789AngleLive: true,
    pr789AngleText: '2028 S Ryan Drakeford · elite angle copy with beat quote.',
    pr6Shadow: { ok: true, rewrittenTweet: 'PR-6 fallback copy without filler.' }
  });
  assert.equal(out.ok, true);
  assert.equal(out.tier, 'pr789_angle');
});

test('falls back to PR-6 when PR-789 angle missing', () => {
  const out = resolvePublishText({}, 'Evans visited and the Gators want more face time.', {
    pr6Shadow: { ok: true, rewrittenTweet: 'Florida surprised Evans on his official visit — Auburn leads his RPM.' }
  });
  assert.equal(out.ok, true);
  assert.equal(out.tier, 'pr6');
});

test('fail closed when only template text available', () => {
  const out = resolvePublishText({}, 'Evans visited and the Gators want more face time.', {
    pr6Shadow: { ok: false, reason: 'rewrite_failed' }
  });
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'intel_incomplete');
});

test('rejects banned phrases even in PR-6 tier', () => {
  const out = resolvePublishText({}, 'template', {
    pr6Shadow: { ok: true, rewrittenTweet: 'That campus visit gives Florida a separation path against Auburn.' }
  });
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'banned_phrases');
});

test('applyPublishSafetyToItem falls back to PR-6 when queued text has banned filler', () => {
  const { applyPublishSafetyToItem } = require('../../lib/autoposter/publish-routing');
  const item = {
    text: 'Evans visited and the Gators want more face time.',
    validationMeta: {
      pr6Shadow: {
        ok: true,
        rewrittenTweet: 'Florida surprised Evans on his official visit — Auburn leads his RPM right now.'
      }
    }
  };
  const out = applyPublishSafetyToItem(item);
  assert.ok(out);
  assert.match(out.text, /Auburn leads his RPM/);
  assert.equal(out.validationMeta.bannedPhraseFallback, true);
});
