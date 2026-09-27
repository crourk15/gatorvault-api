const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, it, before, after } = require('node:test');

describe('hub-runtime verified commit heal', () => {
  let tmpRoot;
  before(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-hub-rt-heal-'));
  });

  after(() => {
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('overwrites durable Armani-only 2028 commits from the git bundle', () => {
    const yearDir = path.join(tmpRoot, 'hub-runtime', '2028');
    fs.mkdirSync(yearDir, { recursive: true });
    fs.writeFileSync(
      path.join(yearDir, 'commits.json'),
      JSON.stringify({
        ok: true,
        meta: { cacheRev: 'c6', year: 2028 },
        items: [{ id: 'armani-strong', name: 'Armani Strong' }],
      })
    );
    fs.writeFileSync(
      path.join(yearDir, 'bundle.json'),
      JSON.stringify({
        ok: true,
        year: 2028,
        commits: [{ id: 'armani-strong', name: 'Armani Strong' }],
        classOverview: { commits: '1' },
      })
    );
    const { mergeBundledHubRuntimeCommitsIfRicher } = require('../../lib/recruiting-data-dir');
    const result = mergeBundledHubRuntimeCommitsIfRicher(tmpRoot);
    assert.equal(result.merged, true);
    const commits = JSON.parse(fs.readFileSync(path.join(yearDir, 'commits.json'), 'utf8'));
    const slugs = (commits.items || []).map((p) => p.id || p.slug);
    assert.ok(slugs.includes('armani-strong'));
    assert.ok(slugs.includes('cyion-smith'));
    const bundle = JSON.parse(fs.readFileSync(path.join(yearDir, 'bundle.json'), 'utf8'));
    assert.ok((bundle.commits || []).some((p) => p.id === 'cyion-smith'));
  });

  it('heals 2028 hero + classOverviewAll even when commits.json is complete', () => {
    const yearDir = path.join(tmpRoot, 'hub-runtime', '2028');
    const otherHeroDir = path.join(tmpRoot, 'hub-runtime', '2027');
    fs.mkdirSync(yearDir, { recursive: true });
    fs.mkdirSync(otherHeroDir, { recursive: true });
    const bundledCommits = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '../../data/recruiting/hub-runtime/2028/commits.json'),
        'utf8'
      )
    );
    fs.writeFileSync(path.join(yearDir, 'commits.json'), JSON.stringify(bundledCommits));
    fs.writeFileSync(
      path.join(yearDir, 'hero.json'),
      JSON.stringify({
        year: 2028,
        classOverview: { commits: '1', avgRating: '89.5', blueChip: '100%' },
        classOverviewAll: {
          2028: { commits: '1', avgRating: '89.5', blueChip: '100%' },
        },
        ticker: ['1 commits locked for 2028'],
      })
    );
    fs.writeFileSync(
      path.join(otherHeroDir, 'hero.json'),
      JSON.stringify({
        year: 2027,
        classOverview: { commits: '25', avgRating: '89.9' },
        classOverviewAll: {
          2028: { commits: '1', avgRating: '90.2', blueChip: '100%' },
        },
      })
    );
    fs.writeFileSync(
      path.join(tmpRoot, 'hub-runtime', 'class-overview-all.json'),
      JSON.stringify({
        2028: { commits: '1', avgRating: '90.2', blueChip: '100%' },
      })
    );
    const { mergeBundledHubRuntimeOverviewIfRicher } = require('../../lib/recruiting-data-dir');
    const result = mergeBundledHubRuntimeOverviewIfRicher(tmpRoot);
    assert.equal(result.merged, true);
    const hero = JSON.parse(fs.readFileSync(path.join(yearDir, 'hero.json'), 'utf8'));
    assert.equal(String(hero.classOverview.commits), '2');
    assert.equal(String(hero.classOverview.avgRating), '89.8');
    const all = JSON.parse(
      fs.readFileSync(path.join(tmpRoot, 'hub-runtime', 'class-overview-all.json'), 'utf8')
    );
    assert.equal(String((all[2028] || all['2028']).commits), '2');
    const hero2027 = JSON.parse(fs.readFileSync(path.join(otherHeroDir, 'hero.json'), 'utf8'));
    assert.equal(String(hero2027.classOverviewAll[2028].commits), '2');
    assert.equal(String(hero2027.classOverviewAll[2028].avgRating), '89.8');
  });

  it('strips Cyion from durable FutureCast HP', () => {
    const hpDir = path.join(tmpRoot, 'futurecast-runtime');
    fs.mkdirSync(hpDir, { recursive: true });
    fs.writeFileSync(
      path.join(hpDir, 'high-priority-2028.json'),
      JSON.stringify({
        classYear: 2028,
        count: 2,
        players: [
          { slug: 'cyion-smith', name: 'Cyion Smith', committedTo: null },
          { slug: 'hudson-west', name: 'Hudson West', committedTo: null },
        ],
      })
    );
    const { stripVerifiedCommitsFromDurableHp } = require('../../lib/recruiting-data-dir');
    const result = stripVerifiedCommitsFromDurableHp(tmpRoot);
    assert.equal(result.merged, true);
    const doc = JSON.parse(fs.readFileSync(path.join(hpDir, 'high-priority-2028.json'), 'utf8'));
    assert.deepEqual(
      doc.players.map((p) => p.slug),
      ['hudson-west']
    );
    assert.equal(doc.count, 1);
  });
});
