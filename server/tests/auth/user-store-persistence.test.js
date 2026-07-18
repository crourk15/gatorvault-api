'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

describe('user-store durable path', () => {
  let tmp;
  let prevUsersPath;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-users-'));
    prevUsersPath = process.env.GV_USERS_PATH;
    delete require.cache[require.resolve('../../lib/user-store')];
  });

  afterEach(() => {
    if (prevUsersPath == null) delete process.env.GV_USERS_PATH;
    else process.env.GV_USERS_PATH = prevUsersPath;
    delete require.cache[require.resolve('../../lib/user-store')];
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('persists register-style saves to GV_USERS_PATH', () => {
    const durable = path.join(tmp, 'users.json');
    process.env.GV_USERS_PATH = durable;
    delete require.cache[require.resolve('../../lib/user-store')];
    const store = require('../../lib/user-store');
    store.saveUsers([
      {
        email: 'fan@example.com',
        passwordHash: 'salt:hash',
        createdAt: new Date().toISOString(),
        trialEnd: new Date(Date.now() + 86400000).toISOString(),
      },
    ]);
    assert.equal(fs.existsSync(durable), true);
    delete require.cache[require.resolve('../../lib/user-store')];
    process.env.GV_USERS_PATH = durable;
    const reloaded = require('../../lib/user-store');
    const users = reloaded.loadUsers();
    assert.equal(users.length, 1);
    assert.equal(users[0].email, 'fan@example.com');
    assert.equal(reloaded.findUserByEmail('fan@example.com')?.email, 'fan@example.com');
  });

  it('atomic save replaces prior contents safely', () => {
    const durable = path.join(tmp, 'users.json');
    process.env.GV_USERS_PATH = durable;
    delete require.cache[require.resolve('../../lib/user-store')];
    const store = require('../../lib/user-store');
    store.saveUsers([{ email: 'a@example.com', passwordHash: 'x:y' }]);
    store.saveUsers([
      { email: 'a@example.com', passwordHash: 'x:y' },
      { email: 'b@example.com', passwordHash: 'x:y' },
    ]);
    const users = store.loadUsers();
    assert.equal(users.length, 2);
    assert.deepEqual(
      users.map((u) => u.email).sort(),
      ['a@example.com', 'b@example.com']
    );
  });
});
