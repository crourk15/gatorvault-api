/**
 * 2027 class commit count — ticker / overview / cards must stay in lockstep.
 * Run: node --test server/test/hub-2027-commit-count.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('2027 hub commit count lockstep', () => {
  it('On3 snapshot includes Stive-Bentley Keumajou (26 HS commits)', () => {
    const { countSnapshotHubCommits, getSnapshotHubCommits } = require('../lib/on3-snapshot-commits');
    assert.equal(countSnapshotHubCommits(2027), 26);
    const slugs = getSnapshotHubCommits(2027).map((p) => p.slug);
    assert.ok(slugs.includes('stive-bentley-keumajou'));
  });

  it('ticker, class-overview, and commit cards share the same count', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.DATABASE_URL;
    const elite = require('../lib/recruiting-hub-elite');
    const [ticker, overview, cards] = await Promise.all([
      elite.buildHubTicker(2027),
      elite.buildHubClassOverview(2027),
      elite.buildHubCommits(2027),
    ]);
    const n = Number(String(overview.commits || '').replace(/[^\d]/g, ''));
    assert.equal(n, 26, `expected 26 HS commits on class overview, got ${overview.commits}`);
    assert.equal(cards.length, n);
    const locked = ticker.find((line) => /\d+\s+commits?\s+locked\s+for\s+2027/i.test(line));
    if (locked) {
      const lockedN = Number(String(locked).match(/(\d+)\s+commits?/i)?.[1]);
      assert.equal(lockedN, n);
    }
    assert.ok(
      Array.isArray(ticker) && ticker.length > 0,
      `expected Home NOW ticker stories, got ${JSON.stringify(ticker)}`
    );
  });

  it('elite builders use loadHubHsClassCommits (no raw-count drift)', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'recruiting-hub-elite.js'), 'utf8');
    assert.match(src, /async function loadHubHsClassCommits/);
    const overviewFn = src.slice(
      src.indexOf('async function buildHubClassOverview'),
      src.indexOf('function movementLabel')
    );
    assert.match(overviewFn, /loadHubHsClassCommits/);
    assert.doesNotMatch(overviewFn, /filterBlockedRecruits\(await store\.getHubHsCommits/);
  });
});
