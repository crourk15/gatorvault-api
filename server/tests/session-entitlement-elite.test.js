const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('session entitlement elite gates', () => {
  const prevUsers = process.env.GV_USERS_PATH;
  const prevNodeEnv = process.env.NODE_ENV;
  let tmpUsers;

  before(() => {
    tmpUsers = path.join(__dirname, '..', 'data', `users-elite-test-${Date.now()}.json`);
    process.env.GV_USERS_PATH = tmpUsers;
    fs.writeFileSync(tmpUsers, '[]');
    delete require.cache[require.resolve('../lib/user-store')];
    delete require.cache[require.resolve('../lib/session-auth')];
    delete require.cache[require.resolve('../lib/subscription-service')];
  });

  after(() => {
    if (prevUsers == null) delete process.env.GV_USERS_PATH;
    else process.env.GV_USERS_PATH = prevUsers;
    process.env.NODE_ENV = prevNodeEnv;
    try { fs.unlinkSync(tmpUsers); } catch { /* ignore */ }
    delete require.cache[require.resolve('../lib/user-store')];
    delete require.cache[require.resolve('../lib/session-auth')];
    delete require.cache[require.resolve('../lib/subscription-service')];
  });

  it('isReservedOperatorEmail blocks domain spoof self-register surface', () => {
    const { isReservedOperatorEmail } = require('../lib/session-auth');
    assert.equal(isReservedOperatorEmail('attacker@gatorvaultinsider.com'), true);
    assert.equal(isReservedOperatorEmail('fan@gmail.com'), false);
  });

  it('sessionHasTier fails closed for missing user even with JWT war tier', () => {
    const { sessionHasTier } = require('../lib/session-auth');
    assert.equal(sessionHasTier({ email: 'ghost@example.com', tier: 'war' }, 'film'), false);
  });

  it('sessionHasTier unlocks Film (not War) during active unpaid trial', () => {
    const { saveUsers, loadUsers } = require('../lib/user-store');
    const { sessionHasTier } = require('../lib/session-auth');
    const trialEnd = new Date(Date.now() + 7 * 86400000).toISOString();
    saveUsers([
      {
        email: 'trial@example.com',
        tier: 'locker',
        trialEnd,
        createdAt: new Date().toISOString(),
      },
    ]);
    assert.equal(loadUsers().length, 1);
    assert.equal(sessionHasTier({ email: 'trial@example.com', tier: 'war' }, 'locker'), true);
    // Trial opens Film soft gates even when stored tier is locker.
    assert.equal(sessionHasTier({ email: 'trial@example.com', tier: 'war' }, 'film'), true);
    // War stays paid-only — JWT war must not unlock War during locker trial.
    assert.equal(sessionHasTier({ email: 'trial@example.com', tier: 'war' }, 'war'), false);
  });

  it('sessionHasTier keeps paid locker below Film after trial ends', () => {
    const { saveUsers } = require('../lib/user-store');
    const { sessionHasTier } = require('../lib/session-auth');
    saveUsers([
      {
        email: 'locker@example.com',
        tier: 'locker',
        paid: true,
        trialEnd: new Date(Date.now() - 86400000).toISOString(),
        createdAt: new Date().toISOString(),
      },
    ]);
    assert.equal(sessionHasTier({ email: 'locker@example.com', tier: 'locker' }, 'locker'), true);
    assert.equal(sessionHasTier({ email: 'locker@example.com', tier: 'locker' }, 'film'), false);
  });

  it('production rejects legacy default admin PIN unless explicitly allowed', () => {
    process.env.NODE_ENV = 'production';
    process.env.DISABLE_DEFAULT_ADMIN_PIN = 'true';
    process.env.ALLOW_LEGACY_ADMIN_PIN = 'false';
    delete process.env.OPS_ADMIN_PIN;
    delete process.env.EMAIL_TEST_PIN;
    delete require.cache[require.resolve('../lib/admin-pin')];
    const { verifyAdminPin } = require('../lib/admin-pin');
    assert.equal(verifyAdminPin('GV2026admin'), false);
  });
});
