const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-password-reset-secret';

const { provisionComplimentaryAccount } = require('../../lib/comp-account-provision');
const { findUserByEmail } = require('../../lib/user-store');
const { hasPaidAccess } = require('../../lib/subscription-service');

async function withUsers(rows, fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-comp-'));
  const prev = process.env.GV_USERS_PATH;
  process.env.GV_USERS_PATH = path.join(tmp, 'users.json');
  fs.writeFileSync(process.env.GV_USERS_PATH, JSON.stringify(rows));
  const { invalidateUsersCache } = require('../../lib/user-store');
  invalidateUsersCache();
  try {
    return await fn();
  } finally {
    invalidateUsersCache();
    if (prev == null) delete process.env.GV_USERS_PATH;
    else process.env.GV_USERS_PATH = prev;
  }
}

test('provision creates a complimentary War Room account and emails setup', async () => {
  await withUsers([], async () => {
    let captured = null;
    const result = await provisionComplimentaryAccount({
      email: 'gatorsbreakdown@gmail.com',
      name: 'Gators Breakdown',
      tier: 'war',
      deliverEmail: async (to, subject, html) => {
        captured = { to, subject, html };
        return { sent: true, provider: 'test' };
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.created, true);
    assert.equal(result.emailSent, true);
    assert.equal(result.tier, 'war');
    assert.match(captured.subject, /create your gatorvault password/i);
    assert.ok(captured.html.includes('/reset/'));

    const user = findUserByEmail('gatorsbreakdown@gmail.com');
    assert.equal(user.complimentary, true);
    assert.equal(hasPaidAccess(user), true);
    assert.equal(user.tier, 'war');
  });
});

test('provision is idempotent and can resend setup for an existing member', async () => {
  await withUsers(
    [
      {
        email: 'gatorsbreakdown@gmail.com',
        name: 'GB',
        passwordHash: 'x',
        tier: 'locker',
        createdAt: '2026-08-01T00:00:00.000Z',
      },
    ],
    async () => {
      const result = await provisionComplimentaryAccount({
        email: 'gatorsbreakdown@gmail.com',
        name: 'Gators Breakdown',
        tier: 'war',
        deliverEmail: async () => ({ sent: true, provider: 'test' }),
      });
      assert.equal(result.ok, true);
      assert.equal(result.created, false);
      assert.equal(result.emailSent, true);
      const user = findUserByEmail('gatorsbreakdown@gmail.com');
      assert.equal(user.name, 'Gators Breakdown');
      assert.equal(hasPaidAccess(user), true);
    }
  );
});
