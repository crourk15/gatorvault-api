/**
 * Member announce exclusions + iOS update email.
 * Run: node --test server/test/member-announce-email.test.js
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  shouldSkipMemberAnnounceRecipient,
  listAnnounceRecipients,
  getIosUpdateAnnounceEmail,
  getArticleAnnounceEmail,
  getIos129ChaseAnnounceEmail,
  getGeorgiaWeekTrialEmail,
  sendGeorgiaWeekTrialAnnounce,
  shouldAutoSendIos129Chase,
  IOS_129_CHASE_SUBJECT,
  GEORGIA_WEEK_TRIAL_SUBJECT,
  SEASON_PREVIEW_2026_URL,
} = require('../lib/member-announce-email');

describe('member announce email', () => {
  it('skips App Review, test, and Charles/Rourk accounts', () => {
    assert.equal(shouldSkipMemberAnnounceRecipient({ email: 'appreview@example.com' }).skip, true);
    assert.equal(shouldSkipMemberAnnounceRecipient({ email: 'test@foo.com' }).skip, true);
    assert.equal(shouldSkipMemberAnnounceRecipient({ email: 'fan+test@gmail.com' }).skip, true);
    assert.equal(shouldSkipMemberAnnounceRecipient({ email: 'crourk15@gmail.com' }).skip, true);
    assert.equal(shouldSkipMemberAnnounceRecipient({ email: 'someone@gmail.com', name: 'Charles Rourk' }).skip, true);
    assert.equal(shouldSkipMemberAnnounceRecipient({ email: 'gatorvaultinsider@gmail.com' }).skip, true);
    assert.equal(shouldSkipMemberAnnounceRecipient({ email: 'ops@gatorvaultinsider.com' }).skip, true);
    assert.equal(shouldSkipMemberAnnounceRecipient({ email: 'real.fan@gmail.com', name: 'Alex Fan' }).skip, false);
  });

  it('lists only active non-excluded members', () => {
    const users = [
      { email: 'fan@gmail.com', name: 'Fan', trialEnd: new Date(Date.now() + 86400000 * 10).toISOString() },
      { email: 'crourk15@gmail.com', name: 'Charles', trialEnd: new Date(Date.now() + 86400000 * 10).toISOString() },
      { email: 'appreview@x.com', trialEnd: new Date(Date.now() + 86400000 * 10).toISOString() },
    ];
    const { recipients, skipped } = listAnnounceRecipients(() => users);
    assert.equal(recipients.length, 1);
    assert.equal(recipients[0].email, 'fan@gmail.com');
    assert.ok(skipped.some((s) => s.reason === 'operator_name_email'));
    assert.ok(skipped.some((s) => s.reason === 'app_review'));
  });

  it('builds App Store update subject for 1.0.15', () => {
    const built = getIosUpdateAnnounceEmail({ email: 'fan@gmail.com', name: 'Fan', version: '1.0.15' });
    assert.match(built.subject, /1\.0\.15/);
    assert.match(built.html, /App Store/);
    assert.match(built.html, /gatorvault-insider/);
  });

  it('builds the 1.0.29 Chase / Closest walkthrough', () => {
    const built = getIos129ChaseAnnounceEmail({ email: 'fan@gmail.com', name: 'Alex' });
    assert.equal(built.subject, IOS_129_CHASE_SUBJECT);
    assert.match(built.html, /Hey Alex/);
    assert.match(built.html, /1\.0\.29/);
    assert.match(built.html, /Priority Chase/);
    assert.match(built.html, /Closest to commit/);
    assert.match(built.html, /Why we chase/);
    assert.match(built.html, /player profile/i);
    assert.match(built.html, /Open FutureCast/);
    assert.match(built.html, /gatorvault-insider/);
    assert.doesNotMatch(built.html, /Read the season preview/);
  });

  it('builds the Georgia week trial letter without TEST or On3', () => {
    const built = getGeorgiaWeekTrialEmail();
    assert.equal(built.subject, GEORGIA_WEEK_TRIAL_SUBJECT);
    assert.equal(/\[TEST\]/.test(built.subject), false);
    assert.match(built.html, /Forward this email to one friend/);
    assert.match(built.html, /30 days free/);
    assert.match(built.html, /gatorvault-insider/);
    assert.match(built.html, /\$9\.99/);
    assert.doesNotMatch(built.html, /On3/);
    assert.doesNotMatch(built.html, /\[TEST\]/);
  });

  it('Georgia week send is trial-only and skips paid / expired / operator', async () => {
    const now = Date.now();
    const users = [
      { email: 'trial@gmail.com', name: 'Trial Fan', trialEnd: new Date(now + 86400000 * 10).toISOString() },
      { email: 'paid@gmail.com', name: 'Paid Fan', paid: true, trialEnd: new Date(now + 86400000 * 10).toISOString() },
      { email: 'expired@gmail.com', name: 'Expired Fan', trialEnd: new Date(now - 86400000 * 2).toISOString() },
      { email: 'crourk15@gmail.com', name: 'Charles', trialEnd: new Date(now + 86400000 * 10).toISOString() },
    ];
    const sentTo = [];
    const result = await sendGeorgiaWeekTrialAnnounce({
      loadUsers: () => users,
      deliverEmail: async (to) => {
        sentTo.push(to);
        return { sent: true, provider: 'test' };
      },
      dryRun: true,
    });
    assert.equal(result.candidateCount, 1);
    assert.equal(result.queued, 1);
    assert.equal(result.details[0].email, 'trial@gmail.com');
    assert.equal(result.details[0].subject, GEORGIA_WEEK_TRIAL_SUBJECT);
    assert.equal(sentTo.length, 0);
    const { recipients } = listAnnounceRecipients(() => users, { trialOnly: true });
    assert.deepEqual(recipients.map((u) => u.email), ['trial@gmail.com']);
  });

  it('does not auto-send 1.0.29 Chase mail unless explicitly enabled', () => {
    assert.equal(shouldAutoSendIos129Chase({ env: { RENDER: 'true' }, nodeEnv: 'production' }), false);
    assert.equal(
      shouldAutoSendIos129Chase({ env: { RENDER: 'true', IOS_129_CHASE_ANNOUNCE_AUTO: '0' }, nodeEnv: 'production' }),
      false
    );
    assert.equal(
      shouldAutoSendIos129Chase({ env: { IOS_129_CHASE_ANNOUNCE_AUTO: '1' }, nodeEnv: 'production' }),
      true
    );
    assert.equal(shouldAutoSendIos129Chase({ env: {}, nodeEnv: 'development' }), false);
  });
});
