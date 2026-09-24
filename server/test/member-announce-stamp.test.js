'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { sendIosUpdateAnnounce, sendIos129ChaseAnnounce } = require('../lib/member-announce-email');

test('sendIosUpdateAnnounce stamps via updateUser after each send', async () => {
  const users = [
    { email: 'fan1@example.com', name: 'Fan One', trialEnd: '2099-01-01T00:00:00.000Z' },
    { email: 'fan2@example.com', name: 'Fan Two', trialEnd: '2099-01-01T00:00:00.000Z' },
  ];
  const stamps = [];
  const result = await sendIosUpdateAnnounce({
    loadUsers: () => users,
    updateUser: (email, patch) => {
      stamps.push({ email, patch });
      const u = users.find((row) => row.email === email);
      Object.assign(u, patch);
      return u;
    },
    deliverEmail: async () => ({ sent: true, provider: 'test', id: '1' }),
    version: '1.0.99',
    concurrency: 2,
  });
  assert.equal(result.sent, 2);
  assert.equal(stamps.length, 2);
  assert.ok(users[0]['iosAnnounce_1.0.99']);
  assert.ok(users[1]['iosAnnounce_1.0.99']);

  const again = await sendIosUpdateAnnounce({
    loadUsers: () => users,
    updateUser: () => null,
    deliverEmail: async () => ({ sent: true, provider: 'test' }),
    version: '1.0.99',
  });
  assert.equal(again.sent, 0);
  assert.ok(again.details.every((d) => d.reason === 'already_sent'));
});

test('sendIos129ChaseAnnounce stamps via updateUser after each send', async () => {
  const os = require('os');
  const path = require('path');
  const prevUsers = process.env.GV_USERS_PATH;
  process.env.GV_USERS_PATH = path.join(os.tmpdir(), `gv-users-129-${Date.now()}.json`);
  const users = [
    { email: 'fan1@example.com', name: 'Fan One', trialEnd: '2099-01-01T00:00:00.000Z' },
    { email: 'fan2@example.com', name: 'Fan Two', trialEnd: '2099-01-01T00:00:00.000Z' },
  ];
  const stamps = [];
  let result;
  try {
  result = await sendIos129ChaseAnnounce({
    loadUsers: () => users,
    updateUser: (email, patch) => {
      stamps.push({ email, patch });
      const u = users.find((row) => row.email === email);
      Object.assign(u, patch);
      return u;
    },
    deliverEmail: async () => ({ sent: true, provider: 'test', id: '1' }),
    concurrency: 2,
  });
  assert.equal(result.sent, 2);
  assert.equal(stamps.length, 2);
  assert.ok(users[0]['iosAnnounce_1_0_29_chase']);
  assert.ok(users[1]['iosAnnounce_1_0_29_chase']);

  const again = await sendIos129ChaseAnnounce({
    loadUsers: () => users,
    updateUser: () => null,
    deliverEmail: async () => ({ sent: true, provider: 'test' }),
  });
  assert.equal(again.sent, 0);
  assert.ok(again.details.every((d) => d.reason === 'already_sent'));

  const fs = require('fs');
  fs.writeFileSync(
    path.join(path.dirname(process.env.GV_USERS_PATH), 'ios-129-chase-announce-last.json'),
    JSON.stringify({ delivered: false, pending: true })
  );
  const third = await sendIos129ChaseAnnounce({
    loadUsers: () => users,
    updateUser: () => null,
    deliverEmail: async () => ({ sent: true, provider: 'test' }),
  });
  assert.equal(third.sent, 0);
  assert.equal(third.force, false);
  } finally {
    if (prevUsers == null) delete process.env.GV_USERS_PATH;
    else process.env.GV_USERS_PATH = prevUsers;
  }
});

test('sendIos129ChaseAnnounce does not stamp when deliverEmail returns sent=false', async () => {
  const os = require('os');
  const path = require('path');
  const prevUsers = process.env.GV_USERS_PATH;
  process.env.GV_USERS_PATH = path.join(os.tmpdir(), `gv-users-129-fail-${Date.now()}.json`);
  const users = [
    { email: 'fan3@example.com', name: 'Fan Three', trialEnd: '2099-01-01T00:00:00.000Z' },
  ];
  try {
    const result = await sendIos129ChaseAnnounce({
      loadUsers: () => users,
      updateUser: () => {
        throw new Error('should not stamp');
      },
      deliverEmail: async () => ({ sent: false, provider: null, error: 'not ready' }),
    });
    assert.equal(result.sent, 0);
    assert.equal(result.failed, 1);
    assert.equal(users[0]['iosAnnounce_1_0_29_chase'], undefined);
  } finally {
    if (prevUsers == null) delete process.env.GV_USERS_PATH;
    else process.env.GV_USERS_PATH = prevUsers;
  }
});
