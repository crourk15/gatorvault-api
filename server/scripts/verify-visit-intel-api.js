const assert = require('node:assert/strict');

function check(label, fn) {
  try {
    fn();
    console.log('  OK', label);
    return true;
  } catch (err) {
    console.error('  FAIL', label, '-', err.message);
    return false;
  }
}

function runVerifyVisitIntelApi() {
  let failed = 0;
  if (
    !check('visit-intel-utils', () => {
      const u = require('../lib/visit-intel-utils');
      assert.equal(typeof u.getVisitIntelBoardSnapshot, 'function');
    })
  ) {
    failed++;
  }
  if (
    !check('visit-guard', () => {
      const g = require('../lib/x-autoposter-visit-guard');
      assert.equal(g.evaluateVisitIntelPostGate({ text: 'hello' }).allow, true);
    })
  ) {
    failed++;
  }
  if (
    !check('policy gate', () => {
      const policy = require('../lib/x-autoposter-policy');
      const result = policy.validatePostContent({
        text: 'Fresh 2027 visit intel updated on FutureCast board',
        category: 'engagement',
        action: 'reply',
        inReplyToStatusId: '123',
        sources: [{ label: 'GatorVault', url: 'https://gatorvaultinsider.com' }],
      });
      assert.equal(result.valid, false);
    })
  ) {
    failed++;
  }
  if (
    !check('visit-intel-reconcile', () => {
      const { reconcileVisitIntelInStore } = require('../lib/expire-stale-visit-intel');
      assert.equal(typeof reconcileVisitIntelInStore, 'function');
    })
  ) {
    failed++;
  }
  if (
    !check('movement-narrative', () => {
      const { buildMovementNarrative } = require('../lib/movement-narrative');
      assert.equal(typeof buildMovementNarrative, 'function');
      const text = buildMovementNarrative({
        delta7d: 6,
        visitStart: '2026-06-01',
        visitEnd: '2026-06-01',
      });
      assert.match(text, /UF \+6%/);
    })
  ) {
    failed++;
  }
  if (
    !check('visit-intel-daily-digest', () => {
      const { runVisitIntelDailyDigest, buildDailyDigestRows } = require('../lib/visit-intel-recap');
      const { sendVisitIntelDailyDigest, buildVisitDailyEmailHtml } = require('../lib/visit-intel-email-digest');
      assert.equal(typeof runVisitIntelDailyDigest, 'function');
      assert.equal(typeof buildDailyDigestRows, 'function');
      assert.equal(typeof sendVisitIntelDailyDigest, 'function');
      assert.match(buildVisitDailyEmailHtml([], '2026-06-22'), /2026-06-22/);
    })
  ) {
    failed++;
  }
  if (
    !check('visit-intel-email-digest', () => {
      const {
        buildVisitScheduledEmailHtml,
        dispatchVisitScheduledEmail,
        sendVisitIntelDailyDigest,
      } = require('../lib/visit-intel-email-digest');
      const { wantsEmailVisitInstant } = require('../lib/alert-email-prefs-service');
      assert.equal(typeof buildVisitScheduledEmailHtml, 'function');
      assert.equal(typeof dispatchVisitScheduledEmail, 'function');
      assert.equal(typeof sendVisitIntelDailyDigest, 'function');
      assert.equal(wantsEmailVisitInstant({ method: 'email', visit: true, freq: 'instant' }), true);
    })
  ) {
    failed++;
  }
  if (
    !check('uf-trend-snapshot', () => {
      const { computeDelta7d, buildDelta7dBySlug, buildTrendHistoryForSlug } = require('../lib/uf-trend-snapshot');
      assert.equal(typeof computeDelta7d, 'function');
      assert.equal(typeof buildDelta7dBySlug, 'function');
      assert.equal(typeof buildTrendHistoryForSlug, 'function');
    })
  ) {
    failed++;
  }
  if (
    !check('push-alert-service', () => {
      const { pushEnabled, buildScheduledPayload, buildCancelledPayload } = require('../lib/push-alert-service');
      assert.equal(typeof buildScheduledPayload, 'function');
      assert.equal(typeof buildCancelledPayload, 'function');
      assert.equal(typeof pushEnabled, 'function');
    })
  ) {
    failed++;
  }
  if (
    !check('staff-note-picker', () => {
      const { pickStaffNoteText } = require('../lib/staff-note-picker');
      assert.equal(typeof pickStaffNoteText, 'function');
      assert.equal(
        pickStaffNoteText({
          playerName: 'Test Player',
          insiderNotes: 'Reports View All Reports -> Test Player Scouting Summary The real note.',
        }),
        'Test Player Scouting Summary The real note.'
      );
    })
  ) {
    failed++;
  }
  return { ok: failed === 0, failed };
}

if (require.main === module) {
  const result = runVerifyVisitIntelApi();
  console.log(result.ok ? 'PASS' : 'FAIL');
  process.exit(result.failed);
}

module.exports = { runVerifyVisitIntelApi };
