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
});
