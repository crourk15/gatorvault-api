const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, it, before, after } = require('node:test');

describe('commits cache rev', () => {
  let tmpRoot;
  let prevDataDir;
  let cache;

  before(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-commits-rev-'));
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

  it('rejects commits disk docs without matching cacheRev', () => {
    const yearDir = path.join(tmpRoot, 'hub-runtime', '2099');
    fs.mkdirSync(yearDir, { recursive: true });
    fs.writeFileSync(
      path.join(yearDir, 'commits.json'),
      JSON.stringify({
        ok: true,
        status: 'ready',
        meta: { endpoint: 'commits', year: 2099 },
        items: [
          {
            id: 'elias-pearl',
            name: 'Elias Pearl',
            metaLine: '4★ WR · Port Charlotte, FL · #91 natl · #19 WR · #11 FL',
          },
        ],
      })
    );
    assert.equal(cache.readHubDiskSnapshot('commits', 2099), null);
  });

  it('writeHubDiskSnapshot stamps COMMITS_CACHE_REV and read accepts it', () => {
    const items = [
      {
        id: 'elias-pearl',
        name: 'Elias Pearl',
        metaLine: '4★ WR · Port Charlotte, FL · #91 natl · #17 WR · #12 FL',
        rating: '93.2',
      },
    ];
    assert.equal(cache.writeHubDiskSnapshot('commits', 2098, items), true);
    const read = cache.readHubDiskSnapshot('commits', 2098);
    assert.ok(Array.isArray(read));
    assert.equal(read[0].metaLine.includes('#17 WR'), true);
    const raw = JSON.parse(
      fs.readFileSync(path.join(tmpRoot, 'hub-runtime', '2098', 'commits.json'), 'utf8')
    );
    assert.equal(raw.meta.cacheRev, cache.COMMITS_CACHE_REV);
  });

  it('hub-snapshot 2027 commits are c4 with Pearl #17/#12', () => {
    const snap = path.join(__dirname, '../../hub-snapshot/2027/commits.json');
    const doc = JSON.parse(fs.readFileSync(snap, 'utf8'));
    assert.equal(doc.meta.cacheRev, 'c4');
    const pearl = (doc.items || []).find((p) => /pearl/i.test(p.name || ''));
    assert.ok(pearl, 'Elias Pearl must be in 2027 commits snapshot');
    assert.match(String(pearl.metaLine || ''), /#17 WR/);
    assert.match(String(pearl.metaLine || ''), /#12 FL/);
  });
});
