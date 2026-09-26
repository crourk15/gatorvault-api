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
    const {
      mergeBundledHubRuntimeCommitsIfRicher,
    } = require('../../lib/recruiting-data-dir');
    const result = mergeBundledHubRuntimeCommitsIfRicher(tmpRoot);
    assert.equal(result.merged, true);
    const commits = JSON.parse(fs.readFileSync(path.join(yearDir, 'commits.json'), 'utf8'));
    const slugs = (commits.items || []).map((p) => p.id || p.slug);
    assert.ok(slugs.includes('armani-strong'));
    assert.ok(slugs.includes('cyion-smith'));
    const bundle = JSON.parse(fs.readFileSync(path.join(yearDir, 'bundle.json'), 'utf8'));
    assert.ok((bundle.commits || []).some((p) => p.id === 'cyion-smith'));
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
