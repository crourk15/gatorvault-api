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

  it('rejects 2028 Armani-only plates and heals Cyion onto the bundle nest', () => {
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
    assert.equal(cache.isUsableCommitsSnapshot([{ id: 'armani-strong' }], 2028), false);
    const full = cache.readHubDiskSnapshot('commits', 2028);
    assert.ok(Array.isArray(full), 'bundled 2028 commits must win over Armani-only runtime');
    assert.ok(
      full.some((p) => /cyion-smith/i.test(String(p.id || p.slug || ''))),
      'Cyion Smith must be on the 2028 commit plate'
    );
    const bundle = {
      year: 2028,
      commits: [{ id: 'armani-strong', name: 'Armani Strong' }],
      classOverview: { commits: '1' },
    };
    cache.healBundleCommitsNest(bundle, 2028);
    assert.ok(bundle.commits.length >= 2);
    assert.ok(bundle.commits.some((p) => /cyion-smith/i.test(String(p.id || p.slug || ''))));
    assert.equal(bundle.classOverview.commits, String(bundle.commits.length));
  });

  it('rejects a 1-commit 2028 hero and heals classOverviewAll from class-overview', () => {
    const yearDir = path.join(tmpRoot, 'hub-runtime', '2028');
    fs.mkdirSync(yearDir, { recursive: true });
    fs.writeFileSync(
      path.join(yearDir, 'hero.json'),
      JSON.stringify({
        ok: true,
        status: 'ready',
        year: 2028,
        classOverview: { commits: '1', avgRating: '89.5', blueChip: '100%' },
        classOverviewAll: {
          2028: { commits: '1', avgRating: '89.5', blueChip: '100%' },
        },
      })
    );
    const hero = cache.readHubDiskSnapshot('hero', 2028);
    assert.ok(hero, 'bundled 2028 hero must win over the 1-commit runtime plate');
    assert.equal(String(hero.classOverview.commits), '2');
    assert.equal(String(hero.classOverview.avgRating), '89.8');

    const stale = {
      year: 2027,
      classOverview: { commits: '25', avgRating: '89.9' },
      classOverviewAll: {
        2028: { commits: '1', avgRating: '90.2', blueChip: '100%' },
      },
    };
    cache.healOverviewNests(stale, 2027);
    assert.equal(String(stale.classOverviewAll[2028].commits), '2');
    assert.equal(String(stale.classOverviewAll[2028].avgRating), '89.8');
  });

  it('hub-runtime 2027 commits are c6 with Pearl #17/#12', () => {
    const snap = path.join(__dirname, '../../data/recruiting/hub-runtime/2027/commits.json');
    const doc = JSON.parse(fs.readFileSync(snap, 'utf8'));
    assert.equal(doc.meta.cacheRev, 'c6');
    const pearl = (doc.items || []).find((p) => /pearl/i.test(p.name || ''));
    assert.ok(pearl, 'Elias Pearl must be in 2027 commits snapshot');
    assert.match(String(pearl.metaLine || ''), /#17 WR/);
    assert.match(String(pearl.metaLine || ''), /#12 FL/);
  });
});
