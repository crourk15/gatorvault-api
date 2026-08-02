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

  it('ranks process + intel chase above bare high-fit allowlist peers', () => {
    const index = buildChaseFeatureIndex({ classYear: 2028 });
    const engaged = computeChaseScore(
      { slug: 'hudson-west', ufFitScore: 40, uf_status: 'TARGET' },
      index
    );
    const lighter = computeChaseScore(
      { slug: 'kaydan-whiteside', ufFitScore: 90, uf_status: 'TARGET' },
      index
    );
    assert.ok(
      engaged.chaseScore > lighter.chaseScore,
      'offer/intel/presence should outrank higher fit with thinner chase signals'
    );
  });

  it('does not let ufFitScore dominate chaseScore', () => {
    const index = buildChaseFeatureIndex({ classYear: 2028 });
    const staffChase = computeChaseScore(
      { slug: 'braxton-rein', ufFitScore: 10, uf_status: 'TARGET' },
      index
    );
    const highFitThin = computeChaseScore(
      { slug: 'kaydan-whiteside', ufFitScore: 99, uf_status: 'TARGET' },
      index
    );
    assert.ok(
      staffChase.chaseScore > highFitThin.chaseScore,
      'staff-side chase must beat bare high UF Fit'
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
    assert.ok(tagged.chaseScore >= bare.chaseScore + 7.9);
  });

  it('Lab high-priority path does not hardcode uf_status TARGET', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'api', 'futurecast', 'high-priority.ts'),
      'utf8'
    );
    assert.match(src, /applyChasePriorityScores/);
    assert.doesNotMatch(src, /uf_status:\s*'TARGET'/);
  });

  it('does not score visit count — locals stacking UVs get the same presence pts', () => {
    const { visitChasePoints } = require('../../lib/uf-chase-score');
    assert.equal(visitChasePoints(0, 1), 3);
    assert.equal(visitChasePoints(0, 2), 3);
    assert.equal(visitChasePoints(0, 5), 3);
    assert.equal(visitChasePoints(1, 0), 6);
    assert.equal(visitChasePoints(2, 3), 6, 'extra OVs/UVs must not add chase points');
  });

  it('grades recent campus presence lightly', () => {
    const { recentVisitPoints } = require('../../lib/uf-chase-score');
    const now = Date.UTC(2026, 7, 2);
    const day = 24 * 60 * 60 * 1000;
    assert.equal(recentVisitPoints(now - 10 * day, now), 3);
    assert.equal(recentVisitPoints(now - 30 * day, now), 2);
    assert.equal(recentVisitPoints(now - 60 * day, now), 1);
    assert.equal(recentVisitPoints(now - 120 * day, now), 0);
  });

  it('ranks staff-side pursuit over multi-visit logistics alone', () => {
    const { computeChaseScore, visitChasePoints } = require('../../lib/uf-chase-score');
    const index = {
      bySlug: new Map([
        ['staff-priority', { ov: 0, uv: 1, home: 0, flOffers: 1, latestVisitAt: 0, pursuitHits: 2, scheduledOv: true }],
        ['local-regular', { ov: 0, uv: 4, home: 0, flOffers: 1, latestVisitAt: 0, pursuitHits: 0, scheduledOv: false }],
      ]),
      allowlisted: new Set(['staff-priority', 'local-regular']),
      staffMap: {
        'staff-priority': { staff_lead_id: 'harris', secondary_recruiter_id: 'chris-prescott' },
        'local-regular': {},
      },
      headliners: new Set(),
      intelCounts: new Map(),
      intelFamilies: new Map(),
      pursuitCounts: new Map([
        ['staff-priority', 2],
        ['local-regular', 0],
      ]),
      scheduledOvSlugs: new Set(['staff-priority']),
      days: 180,
    };
    const priority = computeChaseScore({ slug: 'staff-priority', ufFitScore: 40 }, index);
    const local = computeChaseScore({ slug: 'local-regular', ufFitScore: 90 }, index);
    assert.ok(
      priority.chaseScore > local.chaseScore,
      `staff pursuit (${priority.chaseScore}) should beat local multi-UV (${local.chaseScore})`
    );
    assert.equal(visitChasePoints(0, 4), visitChasePoints(0, 1));
    assert.equal(priority.chase.visitPts, local.chase.visitPts);
    assert.ok(priority.chase.pursuit >= 2);
    assert.equal(priority.chase.hasSecondaryRecruiter, true);
    assert.equal(priority.chase.scheduledOv, true);
  });

  it('treats in-home visits as scarce staff chase — beats stacked campus UVs', () => {
    const { computeChaseScore, isHomeVisit, homeVisitChasePoints } = require('../../lib/uf-chase-score');
    assert.equal(isHomeVisit('home_visit'), true);
    assert.equal(isHomeVisit('unofficial_visit'), false);
    assert.equal(homeVisitChasePoints(1), 18);
    assert.equal(homeVisitChasePoints(2), 22);
    const index = {
      bySlug: new Map([
        ['home-kid', { ov: 0, uv: 0, home: 1, flOffers: 1, latestVisitAt: 0, latestHomeVisitAt: 0 }],
        ['uv-stacker', { ov: 0, uv: 4, home: 0, flOffers: 1, latestVisitAt: 0, latestHomeVisitAt: 0 }],
      ]),
      allowlisted: new Set(['home-kid', 'uv-stacker']),
      staffMap: {},
      headliners: new Set(),
      intelCounts: new Map(),
      intelFamilies: new Map(),
      pursuitCounts: new Map(),
      scheduledOvSlugs: new Set(),
      days: 180,
    };
    const home = computeChaseScore({ slug: 'home-kid', ufFitScore: 40 }, index);
    const local = computeChaseScore({ slug: 'uv-stacker', ufFitScore: 90 }, index);
    assert.ok(
      home.chaseScore > local.chaseScore,
      `home visit (${home.chaseScore}) should beat UV stack (${local.chaseScore})`
    );
    assert.equal(home.chase.home, 1);
    assert.equal(home.chase.homePts, 18);
  });
});
