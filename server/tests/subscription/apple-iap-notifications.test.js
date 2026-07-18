const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  parseAppleNotification,
  handleAppleServerNotification,
} = require('../../lib/apple-iap-notifications');

function encodePayload(payload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function buildSignedInfo(transaction) {
  return `hdr.${encodePayload(transaction)}.sig`;
}

function buildNotification({ type, subtype, transaction }) {
  const notification = {
    notificationType: type,
    subtype,
    data: {
      signedTransactionInfo: buildSignedInfo(transaction),
    },
  };
  return buildSignedInfo(notification);
}

test('parseAppleNotification decodes nested transaction', () => {
  const token = buildNotification({
    type: 'DID_RENEW',
    subtype: '',
    transaction: {
      productId: 'com.gatorvaultinsider.film.monthly',
      originalTransactionId: 'orig-123',
      transactionId: 'tx-456',
      expiresDate: Date.now() + 86400000,
    },
  });
  const parsed = parseAppleNotification(token, { verify: false });
  assert.equal(parsed.type, 'DID_RENEW');
  assert.equal(parsed.transaction.productId, 'com.gatorvaultinsider.film.monthly');
});

test('handleAppleServerNotification activates subscription for known user', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-iap-'));
  const usersPath = path.join(tmp, 'users.json');
  fs.writeFileSync(
    usersPath,
    JSON.stringify([
      {
        email: 'member@test.com',
        paid: false,
        tier: 'locker',
        subscription: { originalTransactionId: 'orig-123' },
      },
    ])
  );
  process.env.GV_USERS_PATH = usersPath;

  const token = buildNotification({
    type: 'DID_RENEW',
    subtype: '',
    transaction: {
      productId: 'com.gatorvaultinsider.film.monthly',
      originalTransactionId: 'orig-123',
      transactionId: 'tx-789',
      expiresDate: Date.now() + 86400000,
    },
  });
  const result = handleAppleServerNotification(token, { verify: false });
  assert.equal(result.handled, true);
  assert.equal(result.action, 'activated');

  const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
  assert.equal(users[0].paid, true);
  assert.equal(users[0].subscription.status, 'active');

  delete process.env.GV_USERS_PATH;
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('handleAppleServerNotification revokes expired subscription', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-iap-'));
  const usersPath = path.join(tmp, 'users.json');
  fs.writeFileSync(
    usersPath,
    JSON.stringify([
      {
        email: 'member@test.com',
        paid: true,
        tier: 'film',
        subscription: { originalTransactionId: 'orig-999', status: 'active' },
      },
    ])
  );
  process.env.GV_USERS_PATH = usersPath;

  const token = buildNotification({
    type: 'EXPIRED',
    subtype: '',
    transaction: {
      productId: 'com.gatorvaultinsider.film.monthly',
      originalTransactionId: 'orig-999',
      transactionId: 'tx-exp',
    },
  });
  const result = handleAppleServerNotification(token, { verify: false });
  assert.equal(result.handled, true);
  assert.equal(result.action, 'revoked');

  const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
  assert.equal(users[0].paid, false);
  assert.equal(users[0].subscription.status, 'expired');

  delete process.env.GV_USERS_PATH;
  fs.rmSync(tmp, { recursive: true, force: true });
});
