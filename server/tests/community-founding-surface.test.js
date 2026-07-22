const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-community-founding-'));
process.env.GV_COMMUNITY_DATA_DIR = tmpDir;
delete require.cache[require.resolve('../lib/community-store')];
const store = require('../lib/community-store');

describe('community founding surface', () => {
  after(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('ensureFoundingSurface seeds staff threads when empty', () => {
    fs.writeFileSync(path.join(store.DATA_DIR, 'threads.json'), '[]');
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
    assert.ok(again.count > 0);
  });
});
