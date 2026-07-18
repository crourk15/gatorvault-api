const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('subscription entitlement elite path', () => {
  it('hasPaidAccess ignores stale paid flag when subscription expired', () => {
    const { hasPaidAccess, isSubscriptionActive } = require('../../lib/subscription-service');
    const user = {
      email: 'fan@example.com',
      paid: true,
      subscription: {
        status: 'active',
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      },
    };
    assert.equal(isSubscriptionActive(user), false);
    assert.equal(hasPaidAccess(user), false);
  });

  it('canceled subscriptions keep access until expiresAt', () => {
    const { hasPaidAccess } = require('../../lib/subscription-service');
    const user = {
      email: 'fan@example.com',
      paid: true,
      subscription: {
        status: 'canceled',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      },
    };
    assert.equal(hasPaidAccess(user), true);
  });

  it('AUTO_RENEW_DISABLED keeps access until period end', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-iap-cancel-'));
    const usersPath = path.join(tmp, 'users.json');
    const expiresAt = new Date(Date.now() + 86400000).toISOString();
    fs.writeFileSync(
      usersPath,
      JSON.stringify([
        {
          email: 'member@test.com',
          paid: true,
          tier: 'film',
          subscription: {
            originalTransactionId: 'orig-cancel',
            status: 'active',
            expiresAt,
            productId: 'com.gatorvaultinsider.film.monthly',
          },
        },
      ])
    );
    process.env.GV_USERS_PATH = usersPath;

    const { handleAppleServerNotification } = require('../../lib/apple-iap-notifications');
    const { hasPaidAccess } = require('../../lib/subscription-service');
    const { findUserByEmail } = require('../../lib/user-store');

    function encodePayload(payload) {
      return Buffer.from(JSON.stringify(payload)).toString('base64url');
    }
    function buildSignedInfo(transaction) {
      return `hdr.${encodePayload(transaction)}.sig`;
    }
    const token = buildSignedInfo({
      notificationType: 'DID_CHANGE_RENEWAL_STATUS',
      subtype: 'AUTO_RENEW_DISABLED',
      data: {
        signedTransactionInfo: buildSignedInfo({
          productId: 'com.gatorvaultinsider.film.monthly',
          originalTransactionId: 'orig-cancel',
          transactionId: 'tx-cancel',
          expiresDate: Date.parse(expiresAt),
        }),
      },
    });

    const result = handleAppleServerNotification(token, { verify: false });
    assert.equal(result.handled, true);
    assert.equal(result.action, 'canceled_keep_access');

    const user = findUserByEmail('member@test.com');
    assert.equal(user.subscription.status, 'canceled');
    assert.equal(hasPaidAccess(user), true);

    delete process.env.GV_USERS_PATH;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('buildSessionFields flags membershipRequired when trial ended unpaid', () => {
    const { buildSessionFields } = require('../../lib/subscription-service');
    const pointsStore = { getUserPoints: () => ({ points: 0, tier: 'locker' }) };
    const fields = buildSessionFields(
      {
        email: 'fan@example.com',
        name: 'Fan',
        tier: 'film',
        paid: false,
        trialEnd: new Date(Date.now() - 1000).toISOString(),
      },
      pointsStore
    );
    assert.equal(fields.accessActive, false);
    assert.equal(fields.membershipRequired, true);
  });
});
