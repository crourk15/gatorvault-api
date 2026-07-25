/** Members list + signup notify helpers. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

test('listRecentMembers returns newest first without password hashes', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-members-'));
  const usersPath = path.join(tmp, 'users.json');
  fs.writeFileSync(
    usersPath,
    JSON.stringify([
      {
        email: 'old@example.com',
        name: 'Old Fan',
        passwordHash: 'secret',
        createdAt: '2026-01-01T00:00:00.000Z',
        trialEnd: '2026-02-01T00:00:00.000Z',
        tier: 'locker',
      },
      {
        email: 'new@example.com',
        name: 'New Fan',
        passwordHash: 'secret2',
        createdAt: '2026-07-25T12:00:00.000Z',
        trialEnd: '2026-08-24T12:00:00.000Z',
        tier: 'locker',
      },
    ])
  );
  const prev = process.env.GV_USERS_PATH;
  process.env.GV_USERS_PATH = usersPath;
  delete require.cache[require.resolve('../../lib/user-store')];
  delete require.cache[require.resolve('../../lib/signup-members')];
  const { listRecentMembers } = require('../../lib/signup-members');
  const payload = listRecentMembers({ limit: 10 });
  assert.equal(payload.ok, true);
  assert.equal(payload.total, 2);
  assert.equal(payload.members[0].email, 'new@example.com');
  assert.equal(payload.members[1].email, 'old@example.com');
  assert.equal(payload.members[0].name, 'New Fan');
  assert.ok(!('passwordHash' in payload.members[0]));
  const json = JSON.stringify(payload);
  assert.ok(!json.includes('secret'));
  if (prev == null) delete process.env.GV_USERS_PATH;
  else process.env.GV_USERS_PATH = prev;
  delete require.cache[require.resolve('../../lib/user-store')];
  delete require.cache[require.resolve('../../lib/signup-members')];
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('listRecentMembers filters by q', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-members-q-'));
  const usersPath = path.join(tmp, 'users.json');
  fs.writeFileSync(
    usersPath,
    JSON.stringify([
      { email: 'alpha@gators.com', name: 'Alpha', createdAt: '2026-07-01T00:00:00.000Z', trialEnd: '2026-08-01T00:00:00.000Z' },
      { email: 'beta@gators.com', name: 'Beta', createdAt: '2026-07-02T00:00:00.000Z', trialEnd: '2026-08-02T00:00:00.000Z' },
    ])
  );
  const prev = process.env.GV_USERS_PATH;
  process.env.GV_USERS_PATH = usersPath;
  delete require.cache[require.resolve('../../lib/user-store')];
  delete require.cache[require.resolve('../../lib/signup-members')];
  const { listRecentMembers } = require('../../lib/signup-members');
  const payload = listRecentMembers({ q: 'beta', limit: 20 });
  assert.equal(payload.members.length, 1);
  assert.equal(payload.members[0].email, 'beta@gators.com');
  if (prev == null) delete process.env.GV_USERS_PATH;
  else process.env.GV_USERS_PATH = prev;
  delete require.cache[require.resolve('../../lib/user-store')];
  delete require.cache[require.resolve('../../lib/signup-members')];
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('notifyOwnerOfSignup uses SIGNUP_NOTIFY_EMAIL and calls deliverEmail', async () => {
  const prev = process.env.SIGNUP_NOTIFY_EMAIL;
  process.env.SIGNUP_NOTIFY_EMAIL = 'owner@gatorvaultinsider.com';
  delete require.cache[require.resolve('../../lib/signup-members')];
  const { notifyOwnerOfSignup, buildSignupNotifyEmail } = require('../../lib/signup-members');
  const built = buildSignupNotifyEmail({
    email: 'fan@example.com',
    name: 'Fan One',
    createdAt: '2026-07-25T12:00:00.000Z',
    trialEnd: '2026-08-24T12:00:00.000Z',
    totalAccounts: 7,
  });
  assert.match(built.subject, /Fan One/);
  assert.match(built.html, /fan@example.com/);
  assert.equal(built.to, 'owner@gatorvaultinsider.com');

  let called = null;
  const result = await notifyOwnerOfSignup(
    {
      email: 'fan@example.com',
      name: 'Fan One',
      createdAt: '2026-07-25T12:00:00.000Z',
      trialEnd: '2026-08-24T12:00:00.000Z',
    },
    async (to, subject, html) => {
      called = { to, subject, html };
      return { sent: true, provider: 'test' };
    }
  );
  assert.equal(result.sent, true);
  assert.equal(called.to, 'owner@gatorvaultinsider.com');
  assert.match(called.subject, /fan@example.com/i);
  if (prev == null) delete process.env.SIGNUP_NOTIFY_EMAIL;
  else process.env.SIGNUP_NOTIFY_EMAIL = prev;
  delete require.cache[require.resolve('../../lib/signup-members')];
});

test('notifyOwnerOfSignup skips when no notify email configured', async () => {
  const keys = ['SIGNUP_NOTIFY_EMAIL', 'OWNER_NOTIFY_EMAIL', 'MONITORING_ALERT_EMAIL', 'ALERT_EMAIL'];
  const prev = {};
  for (const k of keys) {
    prev[k] = process.env[k];
    delete process.env[k];
  }
  delete require.cache[require.resolve('../../lib/signup-members')];
  const { notifyOwnerOfSignup } = require('../../lib/signup-members');
  let called = false;
  const result = await notifyOwnerOfSignup({ email: 'x@y.com', name: 'X' }, async () => {
    called = true;
    return { sent: true };
  });
  assert.equal(result.skipped, true);
  assert.equal(called, false);
  for (const k of keys) {
    if (prev[k] == null) delete process.env[k];
    else process.env[k] = prev[k];
  }
  delete require.cache[require.resolve('../../lib/signup-members')];
});
