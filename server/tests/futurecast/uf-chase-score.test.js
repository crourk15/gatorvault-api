const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildChaseFeatureIndex, computeChaseScore } = require('../../lib/uf-chase-score');

describe('UF chase score (Top Targets traction)', () => {
  it('does not count unofficial_visit as an official visit', () => {
    const { isOfficialVisit, isUnofficialVisit } = require('../../lib/uf-chase-score');
    assert.equal(isUnofficialVisit('unofficial_visit'), true);
    assert.equal(isOfficialVisit('unofficial_visit'), false);
    assert.equal(isOfficialVisit('official_visit'), true);
  });

  it('ranks visit-heavy chase above offer-only allowlist peers', () => {
    const index = buildChaseFeatureIndex({ classYear: 2028 });
    const heavy = computeChaseScore(
      { slug: 'hudson-west', ufFitScore: 40, uf_status: 'TARGET' },
      index
    );
    const lighter = computeChaseScore(
      { slug: 'kaydan-whiteside', ufFitScore: 90, uf_status: 'TARGET' },
      index
    );
    assert.ok(heavy.chaseScore > lighter.chaseScore, 'more OV traction should outrank higher RPM/fit');
    assert.ok((heavy.chase.ov || 0) + (heavy.chase.uv || 0) >= 1, 'hudson-west should carry Florida visit traction');
  });

  it('does not let ufFitScore dominate chaseScore', () => {
    const index = buildChaseFeatureIndex({ classYear: 2028 });
    const lowFitVisits = computeChaseScore(
      { slug: 'kaleb-ballard', ufFitScore: 10, uf_status: 'TARGET' },
      index
    );
    const highFitNoVisits = computeChaseScore(
      { slug: 'kaydan-whiteside', ufFitScore: 99, uf_status: 'TARGET' },
      index
    );
    assert.ok(
      lowFitVisits.chaseScore > highFitNoVisits.chaseScore,
      'visit/offer traction must beat bare high UF Fit'
    );
  });

  it('watchlist API defaults Top Targets path to chase sort support', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'api', 'uf-fit', 'watchlist.ts'), 'utf8');
    assert.match(src, /sort === 'chase'/);
    assert.match(src, /computeChaseScore/);
    const page = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', 'client', 'components', 'futurecast', 'FutureCastBigBoardPage.tsx'),
      'utf8'
    );
    assert.match(page, /sort:\s*'chase'/);
  });

  it('counts intel by unique source-day (not raw row spam)', () => {
    const index = buildChaseFeatureIndex({ classYear: 2028 });
    // antonio-thomas-jr has repeated auto:detectives-beat rows on one day locally
    const n = index.intelCounts.get('antonio-thomas-jr') || 0;
    assert.ok(n <= 3, `expected deduped intel count, got ${n}`);
  });

  it('does not invent TARGET status when uf_status is omitted', () => {
    const index = buildChaseFeatureIndex({ classYear: 2028 });
    const bare = computeChaseScore({ slug: 'hudson-west', ufFitScore: 40 }, index);
    const tagged = computeChaseScore(
      { slug: 'hudson-west', ufFitScore: 40, uf_status: 'TARGET' },
      index
    );
    assert.equal(bare.chase.ufStatus, null);
    assert.equal(tagged.chase.ufStatus, 'TARGET');
    assert.ok(tagged.chaseScore >= bare.chaseScore + 6.9);
  });

  it('Lab high-priority path does not hardcode uf_status TARGET', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'api', 'futurecast', 'high-priority.ts'),
      'utf8'
    );
    assert.match(src, /applyChasePriorityScores/);
    assert.doesNotMatch(src, /uf_status:\s*'TARGET'/);
  });
});
