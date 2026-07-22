const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  shouldSendPaidConfirmation,
  maybeSendPaidMembershipConfirmation,
  isInitialPaidActivationNotification,
} = require('../../lib/membership-confirm');
const { getPaidMembershipConfirmationEmail } = require('../../lib/onboarding-emails');

test('paid confirmation email includes membership language', () => {
  const built = getPaidMembershipConfirmationEmail({
    email: 'fan@example.com',
    name: 'Fan',
    tier: 'film',
    expiresAtStr: 'Friday, August 1, 2026',
  });
  assert.match(built.subject, /membership is active/i);
  assert.ok(built.html.includes('GatorVault'));
  assert.ok(built.html.includes('Film Room'));
  assert.ok(built.html.includes('August 1'));
});

test('shouldSendPaidConfirmation is once-only', () => {
  const after = {
    email: 'a@b.com',
    paid: true,
    subscription: { status: 'active', expiresAt: '2027-01-01T00:00:00.000Z' },
  };
  assert.equal(shouldSendPaidConfirmation({}, after), true);
  assert.equal(
    shouldSendPaidConfirmation({ paidConfirmationSentAt: '2026-01-01T00:00:00.000Z' }, after),
    false
  );
  assert.equal(
    shouldSendPaidConfirmation({}, { ...after, paidConfirmationSentAt: '2026-01-01T00:00:00.000Z' }),
    false
  );
});

test('isInitialPaidActivationNotification skips renewals', () => {
  assert.equal(isInitialPaidActivationNotification('SUBSCRIBED', 'INITIAL_BUY'), true);
  assert.equal(isInitialPaidActivationNotification('OFFER_REDEEMED', ''), true);
  assert.equal(isInitialPaidActivationNotification('DID_RENEW', ''), false);
  assert.equal(isInitialPaidActivationNotification('RENEWAL_EXTENDED', ''), false);
});

test('maybeSendPaidMembershipConfirmation marks user after send', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-paid-confirm-'));
  const usersPath = path.join(tmp, 'users.json');
  fs.writeFileSync(
    usersPath,
    JSON.stringify([
      {
        email: 'new@paid.com',
        name: 'New',
        tier: 'locker',
        paid: true,
        subscription: {
          status: 'active',
          tier: 'locker',
          expiresAt: '2027-01-01T00:00:00.000Z',
        },
      },
    ])
  );
  process.env.GV_USERS_PATH = usersPath;

  const sent = [];
  const result = await maybeSendPaidMembershipConfirmation(
    { email: 'new@paid.com', paid: false },
    {
      email: 'new@paid.com',
      name: 'New',
      tier: 'locker',
      paid: true,
      subscription: {
        status: 'active',
        tier: 'locker',
        expiresAt: '2027-01-01T00:00:00.000Z',
      },
    },
    {
      deliverEmail: async (to, subject) => {
        sent.push({ to, subject });
        return { sent: true, provider: 'test' };
      },
    }
  );

  assert.equal(result.sent, true);
  assert.equal(sent.length, 1);
  const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
  assert.ok(users[0].paidConfirmationSentAt);

  const again = await maybeSendPaidMembershipConfirmation(
    users[0],
    users[0],
    {
      deliverEmail: async () => ({ sent: true, provider: 'test' }),
    }
  );
  assert.equal(again.skipped, true);
  assert.equal(sent.length, 1);

  delete process.env.GV_USERS_PATH;
});
