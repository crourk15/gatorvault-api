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

  it('tapers repeat visits so 3 UVs are not ~3x a single UV', () => {
    const { visitChasePoints } = require('../../lib/uf-chase-score');
    assert.equal(visitChasePoints(0, 1), 7);
    assert.equal(visitChasePoints(0, 2), 10);
    assert.equal(visitChasePoints(0, 3), 11);
    assert.ok(visitChasePoints(0, 3) - visitChasePoints(0, 1) < 7, 'extra UVs must not stack linearly');
    assert.equal(visitChasePoints(1, 0), 14);
    assert.equal(visitChasePoints(2, 0), 19);
  });

  it('grades recent visits instead of a flat 45-day cliff', () => {
    const { recentVisitPoints } = require('../../lib/uf-chase-score');
    const now = Date.UTC(2026, 7, 2);
    const day = 24 * 60 * 60 * 1000;
    assert.equal(recentVisitPoints(now - 10 * day, now), 8);
    assert.equal(recentVisitPoints(now - 30 * day, now), 5);
    assert.equal(recentVisitPoints(now - 60 * day, now), 2);
    assert.equal(recentVisitPoints(now - 120 * day, now), 0);
  });

  it('lets pursuit intensity outrank extra campus trips alone', () => {
    const { computeChaseScore, visitChasePoints } = require('../../lib/uf-chase-score');
    const index = {
      bySlug: new Map([
        ['busy-priority', { ov: 0, uv: 1, flOffers: 1, latestVisitAt: 0, pursuitHits: 2, scheduledOv: true }],
        ['camp-regular', { ov: 0, uv: 3, flOffers: 1, latestVisitAt: 0, pursuitHits: 0, scheduledOv: false }],
      ]),
      allowlisted: new Set(['busy-priority', 'camp-regular']),
      staffMap: {
        'busy-priority': { staff_lead_id: 'harris', secondary_recruiter_id: 'chris-prescott' },
        'camp-regular': {},
      },
      headliners: new Set(),
      intelCounts: new Map(),
      intelFamilies: new Map(),
      pursuitCounts: new Map([
        ['busy-priority', 2],
        ['camp-regular', 0],
      ]),
      scheduledOvSlugs: new Set(['busy-priority']),
      days: 180,
    };
    const priority = computeChaseScore({ slug: 'busy-priority', ufFitScore: 40 }, index);
    const camper = computeChaseScore({ slug: 'camp-regular', ufFitScore: 90 }, index);
    assert.ok(
      priority.chaseScore > camper.chaseScore,
      `1-visit pursuit (${priority.chaseScore}) should beat 3-UV camper (${camper.chaseScore})`
    );
    assert.ok(priority.chase.pursuit >= 2);
    assert.equal(priority.chase.hasSecondaryRecruiter, true);
    assert.equal(priority.chase.scheduledOv, true);
    assert.ok(visitChasePoints(0, 3) > visitChasePoints(0, 1));
  });
});
