import assert from 'node:assert/strict';
import test from 'node:test';
import {
  floridaLeadMargin,
  hasClosestCommitProcessEvidence,
  isFloridaLeadingOnBoard,
  isNextCommitPick,
  nextCommitScore,
} from './competing-schools';
import { buildDiscoveryLeadingPool, type FcLabTarget } from './fc-lab-types';

function warmProcess(
  partial: Partial<NonNullable<FcLabTarget['processEvidence']>> = {}
): NonNullable<FcLabTarget['processEvidence']> {
  return {
    allowlisted: true,
    hasUFOffer: true,
    flOfferCount: 1,
    floridaVisits: 2,
    ov: 0,
    uv: 2,
    home: 0,
    intel90: 2,
    pursuitHits: 0,
    scheduledOv: false,
    recentVisit: true,
    hasProcess: true,
    stillWarm: true,
    closestEligible: true,
    reasons: ['uf_offer', 'florida_visit', 'recent_visit'],
    ...partial,
  };
}

function target(
  partial: Partial<FcLabTarget> & Pick<FcLabTarget, 'slug' | 'name' | 'ufProbability'>
): FcLabTarget {
  return {
    id: partial.slug,
    position: 'QB',
    school: 'Test HS',
    classYear: 2028,
    delta7d: null,
    fitScore: null,
    modelPct: null,
    stars: 4,
    predictors: [],
    competingSchools: [],
    ...partial,
  };
}

test('leading when UF is strictly ahead of top rival even under 34%', () => {
  const p = target({
    slug: 'split-lead',
    name: 'Split Lead',
    ufProbability: 32,
    competingSchools: [
      { name: 'Georgia', pct: 28 },
      { name: 'Alabama', pct: 22 },
    ],
  });
  assert.equal(isFloridaLeadingOnBoard(p), true);
  assert.equal(isNextCommitPick(p), false);
  assert.equal(floridaLeadMargin(p), 4);
});

test('not leading on a tie with top rival', () => {
  const p = target({
    slug: 'tied',
    name: 'Tied Board',
    ufProbability: 40,
    competingSchools: [{ name: 'Miami', pct: 40 }],
  });
  assert.equal(isFloridaLeadingOnBoard(p), false);
});

test('next commit pick scores strong lead + momentum higher than soft lead', () => {
  const closer = target({
    slug: 'closer',
    name: 'Closer',
    ufProbability: 74,
    ufRpmPct: 74,
    delta7d: 6,
    competingSchools: [{ name: 'Tennessee', pct: 18 }],
    closestCommitEligible: true,
    processEvidence: warmProcess(),
  });
  const soft = target({
    slug: 'soft',
    name: 'Soft Lead',
    ufProbability: 36,
    delta7d: -2,
    competingSchools: [{ name: 'Georgia', pct: 30 }],
    processEvidence: warmProcess({ closestEligible: true }),
  });
  assert.equal(isFloridaLeadingOnBoard(closer), true);
  assert.equal(isNextCommitPick(closer), true);
  assert.ok(nextCommitScore(closer) > nextCommitScore(soft));
  assert.equal(isNextCommitPick(soft), false);
});

test('odds-only board lead without process evidence is not Closest to commit', () => {
  const oddsOnly = target({
    slug: 'hamilton-leserra',
    name: 'Hamilton LeSerra',
    ufProbability: 72,
    ufRpmPct: null,
    competingSchools: [],
    stars: 0,
  });
  assert.equal(hasClosestCommitProcessEvidence(oddsOnly), false);
  assert.equal(isNextCommitPick(oddsOnly), false);
});

test('trailing share is not leading', () => {
  const p = target({
    slug: 'trail',
    name: 'Trail',
    ufProbability: 28,
    competingSchools: [{ name: 'Georgia', pct: 55 }],
  });
  assert.equal(isFloridaLeadingOnBoard(p), false);
  assert.equal(nextCommitScore(p), -1);
});

test('discovery leading pool includes Florida board leaders outside chase-hot HP top-N', () => {
  const hotOnly = {
    id: 'hot-1',
    slug: 'hot-chase',
    name: 'Hot Chase',
    classYear: 2028,
    position: 'WR',
    school: 'HS',
    htWt: null,
    stars: 4,
    headliner: false,
    committedTo: null,
    compositeScore: 0.95,
    nationalRank: 10,
    positionRank: 1,
    stateRank: 1,
    rating: 0.95,
    natlRank: 10,
    posRank: 1,
    movementDelta: 2,
    delta7d: 2,
    fitScore: 70,
    staffConfidence: 70,
    priorityScore: 90,
    ufProbability: 38,
    ufRpmPct: 38,
    predictors: [],
    competingSchools: [{ name: 'Georgia', pct: 30 }],
    visitHistory: [],
  };

  const hudsonHp = {
    ...hotOnly,
    id: 'hudson-west',
    slug: 'hudson-west',
    name: 'Hudson West',
    position: 'QB',
    school: 'Carrollwood Day',
    ufProbability: 62,
    ufRpmPct: 62,
    priorityScore: 40,
    competingSchools: [{ name: 'SMU', pct: 20 }],
    closestCommitEligible: true,
    hasUFOffer: true,
    processEvidence: warmProcess(),
  };

  const hudson = {
    id: 'hudson-west',
    slug: 'hudson-west',
    name: 'Hudson West',
    classYear: 2028,
    position: 'QB',
    school: 'Carrollwood Day',
    composite: 0.9,
    stars: 4,
    ufConfidence: 62,
    ufRpmPct: 62,
    trendDelta7d: 0,
    volatility7d: 0,
    priority: 'high',
    committedTo: null,
    predictors: [],
    competingSchools: [{ name: 'SMU', pct: 20 }],
    tier: 'target' as const,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pool = buildDiscoveryLeadingPool([hotOnly as any, hudsonHp as any], [hudson as any], 2028);
  const west = pool.find((p) => p.slug === 'hudson-west');
  assert.ok(west, 'Hudson West must enter Who commits next from underclassmen board');
  assert.equal(isFloridaLeadingOnBoard(west!), true);
  assert.equal(hasClosestCommitProcessEvidence(west!), true);
  assert.equal(isNextCommitPick(west!), true);
  assert.equal(pool.some((p) => p.slug === 'hot-chase'), true);
});
