const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-winback-'));
process.env.GV_USERS_PATH = path.join(tmp, 'users.json');
process.env.GV_TRIAL_LEDGER_PATH = path.join(tmp, 'trial-ledger.json');

const { saveUsers, findUserByEmail } = require('../../lib/user-store');
const {
  shouldSkipWinbackEmail,
  getLockerWinbackEmail,
  runLockerWinback,
  SEP_2026_EXPIRED_LOCKER,
} = require('../../lib/locker-winback');

function expiredUser(email, name, daysAgo) {
  return {
    email,
    name,
    passwordHash: 'SECRET',
    createdAt: new Date(Date.now() - 40 * 86400000).toISOString(),
    trialEnd: new Date(Date.now() - daysAgo * 86400000).toISOString(),
    tier: 'locker',
    paid: false,
  };
}

describe('locker-winback', () => {
  beforeEach(() => {
    saveUsers([]);
    try { fs.unlinkSync(process.env.GV_TRIAL_LEDGER_PATH); } catch { /* empty */ }
  });

  afterEach(() => {
    saveUsers([]);
    try { fs.unlinkSync(process.env.GV_TRIAL_LEDGER_PATH); } catch { /* empty */ }
  });

  it('skips test and demo locker emails', () => {
    assert.equal(shouldSkipWinbackEmail('testeraccount@gamil.com').reason, 'test_email');
    assert.equal(
      shouldSkipWinbackEmail('locker.teaser.look.1786403971@gatorvault.test').reason,
      'test_or_operator'
    );
    assert.equal(shouldSkipWinbackEmail('mekeener50@gmail.com').skip, false);
  });

  it('win-back email sells the extra 30 days and the better app', () => {
    const built = getLockerWinbackEmail({
      name: 'Michael Keener',
      email: 'mekeener50@gmail.com',
      trialEndStr: 'Friday, October 17, 2026',
      days: 30,
    });
    assert.match(built.subject, /30 more days/i);
    assert.match(built.html, /Hey Michael/);
    assert.match(built.html, /another <strong>30 days<\/strong>/);
    assert.match(built.html, /better place/);
    assert.match(built.html, /mekeener50@gmail.com/);
    assert.match(built.html, /gatorvaultinsider.com/);
    assert.ok(!built.html.includes('SECRET'));
  });

  it('extends expired locker trialEnd and emails, skipping test rows', async () => {
    saveUsers([
      expiredUser('mekeener50@gmail.com', 'Michael Keener', 2),
      expiredUser('testeraccount@gamil.com', 'Bookhimdano', 7),
      {
        email: 'paid@example.com',
        name: 'Paid',
        passwordHash: 'SECRET',
        createdAt: new Date().toISOString(),
        trialEnd: new Date(Date.now() - 86400000).toISOString(),
        paid: true,
        subscription: { source: 'stripe', status: 'active', tier: 'locker' },
      },
    ]);

    const sent = [];
    const result = await runLockerWinback({
      emails: [
        'mekeener50@gmail.com',
        'testeraccount@gamil.com',
        'paid@example.com',
        'missing@example.com',
      ],
      days: 30,
      sendEmail: true,
      deliverEmail: async (to, subject) => {
        sent.push({ to, subject });
        return { sent: true, provider: 'test' };
      },
    });

    assert.equal(result.extended, 1);
    assert.equal(result.emailed, 1);
    assert.equal(result.skipped, 3);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, 'mekeener50@gmail.com');

    const fan = findUserByEmail('mekeener50@gmail.com');
    const left = new Date(fan.trialEnd).getTime() - Date.now();
    assert.ok(left > 29 * 86400000 && left < 31 * 86400000);
    assert.equal(fan.trialExtensionReason, 'expired_locker_winback');
    assert.ok(fan.lockerWinbackAt);
    assert.ok(fan.lockerWinbackEmailedAt);
    assert.deepEqual(fan.trialRemindersSent, []);
    assert.equal(Object.prototype.hasOwnProperty.call(JSON.parse(JSON.stringify(result)), 'passwordHash'), false);
  });

  it('dry-run does not write trialEnd or send mail', async () => {
    const before = expiredUser('floridagators2027@icloud.com', 'Michael Brown', 2);
    saveUsers([before]);
    const result = await runLockerWinback({
      emails: ['floridagators2027@icloud.com'],
      dryRun: true,
      deliverEmail: async () => {
        throw new Error('should not send');
      },
    });
    assert.equal(result.extended, 1);
    assert.equal(result.dryRun, true);
    assert.equal(findUserByEmail('floridagators2027@icloud.com').trialEnd, before.trialEnd);
  });

  it('does not double-extend without force', async () => {
    saveUsers([expiredUser('rickbaker250@gmail.com', 'Bob Eugene', 3)]);
    await runLockerWinback({
      emails: ['rickbaker250@gmail.com'],
      sendEmail: false,
    });
    const firstEnd = findUserByEmail('rickbaker250@gmail.com').trialEnd;
    const again = await runLockerWinback({
      emails: ['rickbaker250@gmail.com'],
      sendEmail: false,
    });
    assert.equal(again.skipped, 1);
    assert.equal(again.details[0].reason, 'already_extended');
    assert.equal(findUserByEmail('rickbaker250@gmail.com').trialEnd, firstEnd);
  });

  it('Sep 2026 paste list is 14 real locker emails', () => {
    assert.equal(SEP_2026_EXPIRED_LOCKER.length, 14);
    assert.ok(SEP_2026_EXPIRED_LOCKER.every((row) => !shouldSkipWinbackEmail(row.email).skip));
  });
});
