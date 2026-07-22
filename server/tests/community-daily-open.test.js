const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const store = require('../lib/community-store');
const THREADS_PATH = path.join(store.DATA_DIR, 'threads.json');
const USERS_PATH = path.join(store.DATA_DIR, 'users.json');
const ROOMS_PATH = path.join(store.DATA_DIR, 'live_rooms.json');

describe('community daily open thread', () => {
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

  it('publishes one staff daily OP with zero replies', () => {
    const first = store.ensureDailyOpenThread();
    assert.equal(first.created, true);
    assert.ok(first.thread.dailyKey);
    assert.equal(first.thread.replyCount || 0, 0);
    assert.equal(first.thread.authorEmail, 'staff@gatorvaultinsider.com');
    assert.equal(first.thread.pinned, true);

    const again = store.ensureDailyOpenThread();
    assert.equal(again.created, false);
    assert.equal(again.thread.id, first.thread.id);

    const pulse = store.getPulseStats();
    assert.equal(pulse.repliesToday, 0);
    assert.equal(pulse.trending, 0);
  });

  it('resolves seed_founding_* aliases to thr_founding_*', () => {
    assert.equal(store.resolveThreadId('seed_founding_gameweek'), 'thr_founding_gameweek');
  });
});
