const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { applyStripeSubscription } = require('../../lib/stripe-checkout');
const { hasPaidAccess } = require('../../lib/subscription-service');

function withUsers(users, fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-stripe-ent-'));
  const usersPath = path.join(tmp, 'users.json');
  fs.writeFileSync(usersPath, JSON.stringify(users));
  const prev = process.env.GV_USERS_PATH;
  process.env.GV_USERS_PATH = usersPath;
  try {
    return fn(usersPath);
  } finally {
    if (prev == null) delete process.env.GV_USERS_PATH;
    else process.env.GV_USERS_PATH = prev;
  }
}

test('unpaid Stripe subscription revokes access', () => {
  withUsers(
    [
      {
        email: 'a@b.com',
        paid: true,
        tier: 'film',
        subscription: { status: 'active', source: 'stripe', expiresAt: '2027-01-01T00:00:00.000Z' },
      },
    ],
    () => {
      const sub = {
        id: 'sub_1',
        status: 'unpaid',
        customer: 'cus_1',
        current_period_end: Math.floor(Date.now() / 1000) - 100,
        items: { data: [{ price: { id: 'price_film_m' } }] },
        metadata: { gatorvaultTier: 'film' },
      };
      const user = applyStripeSubscription('a@b.com', sub);
      assert.equal(hasPaidAccess(user), false);
      assert.equal(user.subscription.status, 'expired');
    }
  );
});

test('canceled Stripe subscription keeps access until period end', () => {
  withUsers(
    [
      {
        email: 'a@b.com',
        paid: true,
        tier: 'film',
        subscription: { status: 'active', source: 'stripe' },
      },
    ],
    () => {
      const end = Math.floor(Date.now() / 1000) + 86400;
      const sub = {
        id: 'sub_2',
        status: 'canceled',
        customer: 'cus_1',
        cancel_at_period_end: true,
        current_period_end: end,
        items: { data: [{ price: { id: 'price_film_m' } }] },
        metadata: { gatorvaultTier: 'film' },
      };
      const user = applyStripeSubscription('a@b.com', sub);
      assert.equal(user.subscription.status, 'canceled');
      assert.equal(hasPaidAccess(user), true);
    }
  );
});
