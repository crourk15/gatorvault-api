const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-community-daily-'));
process.env.GV_COMMUNITY_DATA_DIR = tmpDir;
delete require.cache[require.resolve('../lib/community-store')];
const store = require('../lib/community-store');

describe('community daily open thread', () => {
  after(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  before(() => {
    fs.mkdirSync(store.DATA_DIR, { recursive: true });
    fs.writeFileSync(path.join(store.DATA_DIR, 'threads.json'), '[]');
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

  it('hides empty past Daily opens from the feed (keeps today + replied dailies)', () => {
    const today = store.ensureDailyOpenThread();
    assert.ok(today.thread?.id);

    const threadsPath = path.join(store.DATA_DIR, 'threads.json');
    const rows = JSON.parse(fs.readFileSync(threadsPath, 'utf8'));
    rows.push({
      id: 'thr_daily_old_empty',
      title: 'Daily open: what moved Florida’s board overnight?',
      body: 'Old empty daily',
      categoryId: 'cat_war',
      categorySlug: 'war',
      authorId: 'usr_gv_staff',
      authorEmail: 'staff@gatorvaultinsider.com',
      pinned: false,
      featured: false,
      replyCount: 0,
      viewCount: 0,
      lastActivityAt: '2026-08-01T12:00:00.000Z',
      createdAt: '2026-08-01T12:00:00.000Z',
      dailyKey: '2026-08-01',
      deleted: false,
    });
    rows.push({
      id: 'thr_daily_old_replied',
      title: 'Daily open: portal fit you’d prioritize before fall camp',
      body: 'Old daily with talk',
      categoryId: 'cat_locker',
      categorySlug: 'locker',
      authorId: 'usr_gv_staff',
      authorEmail: 'staff@gatorvaultinsider.com',
      pinned: false,
      featured: false,
      replyCount: 2,
      viewCount: 4,
      lastActivityAt: '2026-08-10T12:00:00.000Z',
      createdAt: '2026-08-10T12:00:00.000Z',
      dailyKey: '2026-08-10',
      deleted: false,
    });
    fs.writeFileSync(threadsPath, JSON.stringify(rows, null, 2));

    const feed = store.getThreads({ sort: 'recent', limit: 50 });
    const ids = feed.map((t) => t.id);
    assert.ok(ids.includes(today.thread.id), 'today daily stays');
    assert.ok(ids.includes('thr_daily_old_replied'), 'replied past daily stays');
    assert.ok(!ids.includes('thr_daily_old_empty'), 'empty past daily hidden');
  });
});
