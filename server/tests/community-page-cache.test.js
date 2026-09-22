const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-community-page-'));
process.env.GV_COMMUNITY_DATA_DIR = tmpDir;
delete require.cache[require.resolve('../lib/community-store')];
delete require.cache[require.resolve('../lib/community-page-cache')];
const store = require('../lib/community-store');
const pageCache = require('../lib/community-page-cache');

describe('community public page cache', () => {
  after(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  before(() => {
    fs.mkdirSync(store.DATA_DIR, { recursive: true });
    fs.writeFileSync(path.join(store.DATA_DIR, 'threads.json'), '[]');
    fs.writeFileSync(path.join(store.DATA_DIR, 'posts.json'), '[]');
    store.resetDailyOpenMemo();
    pageCache.invalidateCommunityPageCache();
  });

  it('getPublicPage returns threads + pulse in one pass', () => {
    const page = store.getPublicPage({ sort: 'recent', limit: 12 });
    assert.ok(Array.isArray(page.categories));
    assert.ok(page.categories.length >= 1);
    assert.ok(Array.isArray(page.threads));
    assert.ok(page.threads.length >= 1);
    assert.ok(page.pulse);
    assert.equal(typeof page.pulse.trending, 'number');
    assert.ok(Array.isArray(page.rooms));
    assert.ok(Array.isArray(page.gameRooms));
  });

  it('second ensureDailyOpenThread is memoized and still returns the thread', () => {
    const first = store.ensureDailyOpenThread();
    const again = store.ensureDailyOpenThread();
    assert.equal(again.created, false);
    assert.ok(again.thread);
    assert.equal(again.thread.id, first.thread.id);
  });

  it('memory cache hits on the second getPage', () => {
    pageCache.invalidateCommunityPageCache();
    const first = pageCache.getPage({ sort: 'recent', limit: 10 });
    assert.equal(first.cacheHit, false);
    const second = pageCache.getPage({ sort: 'recent', limit: 10 });
    assert.equal(second.cacheHit, true);
    assert.equal(second.threads.length, first.threads.length);
  });

  it('invalidate drops the cached hub', () => {
    pageCache.getPage({ sort: 'recent', limit: 10 });
    pageCache.invalidateCommunityPageCache();
    const next = pageCache.getPage({ sort: 'recent', limit: 10 });
    assert.equal(next.cacheHit, false);
  });
});
