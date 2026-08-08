'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('changeUserEmail', () => {
  let tmp;
  let store;

  before(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-change-email-'));
    process.env.GV_USERS_PATH = path.join(tmp, 'users.json');
    fs.writeFileSync(
      process.env.GV_USERS_PATH,
      JSON.stringify(
        [
          {
            email: 'mossyheadedgator@outlook.coom',
            name: 'Paul Preedom',
            tier: 'locker',
            passwordHash: 'x',
            trialEnd: '2026-09-07T00:00:00.000Z',
          },
        ],
        null,
        2
      )
    );
    delete require.cache[require.resolve('../../lib/user-store')];
    store = require('../../lib/user-store');
  });

  after(() => {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    delete process.env.GV_USERS_PATH;
    delete require.cache[require.resolve('../../lib/user-store')];
  });

  it('renames typo email and keeps the account', () => {
    const result = store.changeUserEmail(
      'mossyheadedgator@outlook.coom',
      'mossyheadedgator@outlook.com'
    );
    assert.equal(result.ok, true);
    assert.equal(result.to, 'mossyheadedgator@outlook.com');
    assert.equal(store.findUserByEmail('mossyheadedgator@outlook.coom'), null);
    const user = store.findUserByEmail('mossyheadedgator@outlook.com');
    assert.ok(user);
    assert.equal(user.name, 'Paul Preedom');
    assert.deepEqual(user.previousEmails, ['mossyheadedgator@outlook.coom']);
  });
});
