'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  LEAD_PCT_MIN,
  NATL_RANK_MAX,
  ELITE_NATL_RANK_MAX,
  evaluateTrueTarget2028,
  listFormulaTrueTargetSlugs2028,
} = require('../lib/allowlist-true-target-2028');

describe('allowlist true-target 2028 formula', () => {
  it('locks Path A (≥70 + Top-100) and Path B (Top-50) thresholds', () => {
    assert.equal(LEAD_PCT_MIN, 70);
    assert.equal(NATL_RANK_MAX, 100);
    assert.equal(ELITE_NATL_RANK_MAX, 50);
  });

  it('auto-includes Florida-lead Top-100 (Mannings-style 92% PM)', () => {
    const player = {
      slug: 'tyree-mannings-jr',
      name: 'Tyree Mannings Jr.',
      classYear: 2028,
      status: 'uncommitted',
      committedTo: null,
      category: 'target',
      stars: 4,
      natlRank: 88,
      rivalsConfidence: 92,
      rivalsLastPrediction: 'Florida',
      ufRpmPct: 18,
    };
    const result = evaluateTrueTarget2028(player);
    assert.equal(result.ok, true);
    assert.equal(result.leadSource, 'rivals_pm');
    assert.equal(result.leadPct, 92);
    assert.equal(result.path, 'lead70_top100');
  });

  it('auto-includes Top-50 when Florida leads under 70% (Jamarcus-style)', () => {
    const player = {
      slug: 'jamarcus-johnson',
      name: 'Jamarcus Johnson',
      classYear: 2028,
      status: 'uncommitted',
      committedTo: null,
      category: 'target',
      stars: 4,
      natlRank: 50,
      ufRpmPct: 49,
      competitors: [
        { school: 'Florida', pct: 49 },
        { school: 'Georgia', pct: 23 },
      ],
    };
    const result = evaluateTrueTarget2028(player);
    assert.equal(result.ok, true);
    assert.equal(result.path, 'top50_uf_lead');
    assert.equal(result.leadPct, 49);
  });

  it('rejects Top-50 when Florida is not #1', () => {
    const player = {
      slug: 'some-wr',
      classYear: 2028,
      status: 'uncommitted',
      category: 'target',
      stars: 4,
      natlRank: 40,
      ufRpmPct: 12,
      competitors: [
        { school: 'Notre Dame', pct: 38 },
        { school: 'Florida', pct: 12 },
      ],
    };
    const result = evaluateTrueTarget2028(player);
    assert.equal(result.ok, false);
  });

  it('rejects high lead outside Top-100 when ranked', () => {
    const player = {
      slug: 'cyion-smith',
      classYear: 2028,
      status: 'uncommitted',
      category: 'target',
      stars: 4,
      natlRank: 175,
      ufRpmPct: 97,
    };
    const result = evaluateTrueTarget2028(player);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'board_quality_below_threshold');
  });

  it('rejects Top-100 without Florida lead', () => {
    const player = {
      slug: 'mid-board-wr',
      classYear: 2028,
      status: 'uncommitted',
      category: 'target',
      stars: 4,
      natlRank: 88,
      ufRpmPct: 12,
      rivalsConfidence: null,
      competitors: [
        { school: 'Notre Dame', pct: 38 },
        { school: 'Florida', pct: 12 },
      ],
    };
    const result = evaluateTrueTarget2028(player);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'florida_lead_below_threshold');
  });

  it('allows 4★ with null national rank when Florida leads (rank lag)', () => {
    const player = {
      slug: 'rank-lag-wr',
      classYear: 2028,
      status: 'uncommitted',
      category: 'target',
      stars: 4,
      natlRank: null,
      rivalsConfidence: 80,
      rivalsLastPrediction: 'Florida',
    };
    const result = evaluateTrueTarget2028(player);
    assert.equal(result.ok, true);
  });

  it('merges formula slugs into getAllowlistSet(2028)', () => {
    const { getAllowlistSet } = require('../lib/recruiting-target-allowlist');
    const set = getAllowlistSet(2028);
    const formula = listFormulaTrueTargetSlugs2028();
    for (const slug of formula) {
      assert.equal(set.has(slug), true, `missing formula slug ${slug}`);
    }
    assert.equal(set.has('tyree-mannings-jr'), true);
  });
});
