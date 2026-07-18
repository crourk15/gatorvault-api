'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

describe('uf-trend-snapshot durable store', () => {
  let tmp;
  let prevDir;
  let prevNode;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-fc-'));
    prevDir = process.env.GV_FUTURECAST_DATA_DIR;
    prevNode = process.env.NODE_ENV;
    process.env.GV_FUTURECAST_DATA_DIR = tmp;
    delete require.cache[require.resolve('../../lib/uf-trend-snapshot')];
  });

  afterEach(() => {
    if (prevDir == null) delete process.env.GV_FUTURECAST_DATA_DIR;
    else process.env.GV_FUTURECAST_DATA_DIR = prevDir;
    if (prevNode == null) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNode;
    delete require.cache[require.resolve('../../lib/uf-trend-snapshot')];
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('persists snapshots under GV_FUTURECAST_DATA_DIR and batches recordGvSnapshots', () => {
    const store = require('../../lib/uf-trend-snapshot');
    const info = store.getUfTrendStoreInfo();
    assert.equal(info.durable, true);
    assert.ok(String(info.path).startsWith(tmp));

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
    store.upsertSnapshot('tranard-roberts', 70, sevenDaysAgo.toISOString().slice(0, 10), {
      source: 'gatorvault',
    });
    store.recordGvSnapshots([{ slug: 'tranard-roberts', ufConfidence: 78, ufRpmPct: 74 }]);

    const delta = store.computeDelta7d('tranard-roberts', new Date(), {
      preferSource: 'gatorvault',
      requireSource: true,
    });
    assert.equal(delta, 8);
    assert.equal(fs.existsSync(path.join(tmp, 'uf-trend-snapshots.json')), true);
  });
});
