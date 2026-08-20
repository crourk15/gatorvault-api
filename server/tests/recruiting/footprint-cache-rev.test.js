const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, it, before, after } = require('node:test');

describe('footprint cache rev and heal', () => {
  let tmpRoot;
  let prevDataDir;
  let cache;

  before(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-fp-rev-'));
    prevDataDir = process.env.GV_RECRUITING_DATA_DIR;
    process.env.GV_RECRUITING_DATA_DIR = tmpRoot;
    delete require.cache[require.resolve('../../lib/recruiting-data-dir')];
    delete require.cache[require.resolve('../../lib/recruiting-hub-cache')];
    cache = require('../../lib/recruiting-hub-cache');
  });

  after(() => {
    if (prevDataDir == null) delete process.env.GV_RECRUITING_DATA_DIR;
    else process.env.GV_RECRUITING_DATA_DIR = prevDataDir;
    delete require.cache[require.resolve('../../lib/recruiting-data-dir')];
    delete require.cache[require.resolve('../../lib/recruiting-hub-cache')];
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('rejects footprint disk docs without matching cacheRev', () => {
    // Use a year with no deploy hub-snapshot so runtime is the only candidate.
    const yearDir = path.join(tmpRoot, 'hub-runtime', '2099');
    fs.mkdirSync(yearDir, { recursive: true });
    fs.writeFileSync(
      path.join(yearDir, 'footprint.json'),
      JSON.stringify({
        ok: true,
        status: 'ready',
        meta: { cacheRev: 'fp2', endpoint: 'footprint', year: 2099 },
        states: [{ state: 'FL', commits: 0, targets: 50 }],
        pins: [],
        year: 2099,
      })
    );
    assert.equal(cache.readHubDiskSnapshot('footprint', 2099), null);
  });

  it('accepts fp3 footprint and heals zero-commit plates when commits exist', () => {
    const yearDir = path.join(tmpRoot, 'hub-runtime', '2028');
    fs.mkdirSync(yearDir, { recursive: true });
    fs.writeFileSync(
      path.join(yearDir, 'commits.json'),
      JSON.stringify({
        ok: true,
        status: 'ready',
        meta: {
          endpoint: 'commits',
          year: 2028,
          cacheRev: cache.COMMITS_CACHE_REV,
        },
        items: [{ id: 'armani-strong', name: 'Armani Strong' }],
      })
    );
    const poisoned = {
      states: [{ state: 'FL', commits: 0, targets: 50 }],
      pins: [],
      year: 2028,
    };
    assert.equal(cache.isUsableFootprintSnapshot(poisoned, 2028), false);

    const good = {
      states: [{ state: 'FL', commits: 1, targets: 50 }],
      pins: [{ id: 'armani-strong', pinType: 'commit' }],
      year: 2028,
    };
    assert.equal(cache.isUsableFootprintSnapshot(good, 2028), true);

    cache.writeHubDiskSnapshot('footprint', 2028, good);
    const read = cache.readHubDiskSnapshot('footprint', 2028);
    assert.ok(read);
    assert.equal(cache.footprintStateCommitCount(read), 1);
    const raw = JSON.parse(fs.readFileSync(path.join(yearDir, 'footprint.json'), 'utf8'));
    assert.equal(raw.meta.cacheRev, cache.FOOTPRINT_CACHE_REV);
  });

  it('bundled hub-runtime 2028 footprint is fp3 with Armani commit', () => {
    const snap = path.join(__dirname, '../../data/recruiting/hub-runtime/2028/footprint.json');
    const doc = JSON.parse(fs.readFileSync(snap, 'utf8'));
    assert.equal(doc.meta.cacheRev, 'fp3');
    const commits = (doc.states || []).reduce((n, s) => n + (s.commits || 0), 0);
    assert.ok(commits >= 1, '2028 footprint seed must count HS commits');
    const armani = (doc.pins || []).find((p) => p.id === 'armani-strong');
    assert.ok(armani, 'Armani Strong must pin');
    assert.equal(armani.pinType, 'commit');
  });

  it('skips poisoned durable runtime and falls back to bundled fp3 seed', () => {
    const yearDir = path.join(tmpRoot, 'hub-runtime', '2028');
    fs.mkdirSync(yearDir, { recursive: true });
    fs.writeFileSync(
      path.join(yearDir, 'footprint.json'),
      JSON.stringify({
        ok: true,
        status: 'ready',
        meta: { endpoint: 'footprint', year: 2028 },
        states: [{ state: 'FL', commits: 0, targets: 139 }],
        pins: [],
        year: 2028,
      })
    );
    const read = cache.readHubDiskSnapshot('footprint', 2028);
    assert.ok(read, 'bundled seed must win over poisoned durable disk');
    assert.equal(cache.footprintStateCommitCount(read), 1);
  });

  it('heals poisoned bundle.footprint nest from dedicated footprint disk', () => {
    const yearDir = path.join(tmpRoot, 'hub-runtime', '2028');
    fs.mkdirSync(yearDir, { recursive: true });
    fs.writeFileSync(
      path.join(yearDir, 'commits.json'),
      JSON.stringify({
        ok: true,
        status: 'ready',
        meta: { endpoint: 'commits', year: 2028, cacheRev: cache.COMMITS_CACHE_REV },
        items: [{ id: 'armani-strong', name: 'Armani Strong' }],
      })
    );
    const healthyFp = {
      states: [{ state: 'FL', commits: 1, targets: 12 }],
      pins: [{ id: 'armani-strong', pinType: 'commit', name: 'Armani Strong' }],
      year: 2028,
    };
    cache.writeHubDiskSnapshot('footprint', 2028, healthyFp);

    const poisonedBundle = {
      year: 2028,
      commits: [{ id: 'armani-strong', name: 'Armani Strong' }],
      classOverview: { commits: '1' },
      footprint: {
        states: [{ state: 'FL', commits: 0, targets: 147 }],
        pins: [],
        year: 2028,
      },
    };
    const healed = cache.healBundleFootprintNest(poisonedBundle, 2028);
    assert.equal(cache.footprintStateCommitCount(healed.footprint), 1);
    assert.ok((healed.footprint.pins || []).some((p) => p.id === 'armani-strong'));
  });
});
