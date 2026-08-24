'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-community-author-'));
process.env.GV_COMMUNITY_DATA_DIR = tmpDir;
delete require.cache[require.resolve('../lib/community-store')];
const store = require('../lib/community-store');

describe('community thread author on detail', () => {
  after(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  before(() => {
    fs.mkdirSync(store.DATA_DIR, { recursive: true });
    const user = {
      id: 'usr_test_member',
      email: 'member@example.com',
      displayName: 'Bookhimdano',
      avatarUrl: null,
      tier: 'film',
      isFounding: true,
      joinDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    const thread = {
      id: 'thr_test_cb1',
      title: 'Whos going to be CB1',
      body: 'Im hearing its BHIII.',
      categoryId: 'cat_locker',
      categorySlug: 'locker',
      authorId: user.id,
      authorEmail: user.email,
      pinned: false,
      locked: false,
      featured: false,
      replyCount: 0,
      viewCount: 0,
      lastActivityAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      deleted: false,
    };
    fs.writeFileSync(path.join(store.DATA_DIR, 'users.json'), JSON.stringify([user]));
    fs.writeFileSync(path.join(store.DATA_DIR, 'threads.json'), JSON.stringify([thread]));
    fs.writeFileSync(path.join(store.DATA_DIR, 'posts.json'), '[]');
    fs.writeFileSync(path.join(store.DATA_DIR, 'categories.json'), JSON.stringify([]));
  });

  it('nests author.displayName on thread for open-thread UI', () => {
    const data = store.getThreadById('thr_test_cb1', false);
    assert.ok(data);
    assert.equal(data.thread.author?.displayName, 'Bookhimdano');
    assert.equal(data.thread.authorDisplay, 'Bookhimdano');
    assert.equal(data.author?.displayName, 'Bookhimdano');
  });
});
