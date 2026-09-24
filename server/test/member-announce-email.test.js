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
  shouldAutoSendIos129Chase,
  IOS_129_CHASE_SUBJECT,
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

  it('auto-sends 1.0.29 Chase mail on production Render unless disabled', () => {
    assert.equal(shouldAutoSendIos129Chase({ env: { RENDER: 'true' }, nodeEnv: 'production' }), true);
    assert.equal(
      shouldAutoSendIos129Chase({ env: { RENDER: 'true', IOS_129_CHASE_ANNOUNCE_AUTO: '0' }, nodeEnv: 'production' }),
      false
    );
    assert.equal(shouldAutoSendIos129Chase({ env: {}, nodeEnv: 'development' }), false);
  });
});
