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
});
