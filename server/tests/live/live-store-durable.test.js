'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

describe('live-store durable beat cache', () => {
  let tmp;
  let prevLiveDir;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-live-'));
    prevLiveDir = process.env.GV_LIVE_DATA_DIR;
    process.env.GV_LIVE_DATA_DIR = tmp;
    delete require.cache[require.resolve('../../lib/live-store')];
  });

  afterEach(() => {
    if (prevLiveDir == null) delete process.env.GV_LIVE_DATA_DIR;
    else process.env.GV_LIVE_DATA_DIR = prevLiveDir;
    delete require.cache[require.resolve('../../lib/live-store')];
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('persists beat cache under GV_LIVE_DATA_DIR', () => {
    const store = require('../../lib/live-store');
    store.saveBeatCache({
      posts: [{ id: 'x_1', text: 'Florida visit intel', publishedAt: new Date().toISOString() }],
      fetchedAt: new Date().toISOString(),
      source: 'x',
      error: null,
    });
    const info = store.getLiveStoreInfo();
    assert.equal(info.durableEnv, true);
    assert.equal(info.dataDir, tmp);
    assert.equal(fs.existsSync(path.join(tmp, 'beat-cache.json')), true);

    delete require.cache[require.resolve('../../lib/live-store')];
    process.env.GV_LIVE_DATA_DIR = tmp;
    const reloaded = require('../../lib/live-store');
    const cache = reloaded.loadBeatCache();
    assert.equal(cache.posts.length, 1);
    assert.equal(cache.source, 'x');
  });
});
