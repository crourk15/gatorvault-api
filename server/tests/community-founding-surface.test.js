const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const store = require('../lib/community-store');
const THREADS_PATH = path.join(store.DATA_DIR, 'threads.json');
const USERS_PATH = path.join(store.DATA_DIR, 'users.json');
const ROOMS_PATH = path.join(store.DATA_DIR, 'live_rooms.json');

describe('community founding surface', () => {
  let threadsBackup = null;
  let usersBackup = null;
  let roomsBackup = null;

  before(() => {
    fs.mkdirSync(store.DATA_DIR, { recursive: true });
    threadsBackup = fs.existsSync(THREADS_PATH) ? fs.readFileSync(THREADS_PATH, 'utf8') : null;
    usersBackup = fs.existsSync(USERS_PATH) ? fs.readFileSync(USERS_PATH, 'utf8') : null;
    roomsBackup = fs.existsSync(ROOMS_PATH) ? fs.readFileSync(ROOMS_PATH, 'utf8') : null;
    fs.writeFileSync(THREADS_PATH, '[]');
  });

  after(() => {
    if (threadsBackup != null) fs.writeFileSync(THREADS_PATH, threadsBackup);
    else if (fs.existsSync(THREADS_PATH)) fs.writeFileSync(THREADS_PATH, '[]');
    if (usersBackup != null) fs.writeFileSync(USERS_PATH, usersBackup);
    if (roomsBackup != null) fs.writeFileSync(ROOMS_PATH, roomsBackup);
  });

  it('ensureFoundingSurface seeds staff threads when empty', () => {
    const out = store.ensureFoundingSurface();
    assert.equal(out.seeded, true);
    assert.ok(out.count >= 4);
    const threads = store.getThreads({ limit: 40 });
    assert.ok(threads.length >= 4);
    assert.ok(threads.every((t) => (t.replyCount || 0) === 0));
    assert.ok(threads.some((t) => /board priority/i.test(t.title || '')));
  });

  it('ensureFoundingSurface is idempotent when threads exist', () => {
    const again = store.ensureFoundingSurface();
    assert.equal(again.seeded, false);
    assert.ok(again.count >= 4);
  });
});
