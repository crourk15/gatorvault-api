'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { sendIosUpdateAnnounce } = require('../lib/member-announce-email');

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
