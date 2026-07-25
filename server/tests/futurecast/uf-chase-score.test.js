const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildChaseFeatureIndex, computeChaseScore } = require('../../lib/uf-chase-score');

describe('UF chase score (Top Targets traction)', () => {
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
    assert.ok(heavy.chase.ov >= 1, 'hudson-west should carry Florida visit traction');
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
      'visit traction must beat bare high UF Fit'
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
});
