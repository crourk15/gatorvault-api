import assert from 'node:assert/strict';
import test from 'node:test';
import {
  floridaLeadMargin,
  isFloridaLeadingOnBoard,
  isNextCommitPick,
  nextCommitScore,
} from './competing-schools';
import type { FcLabTarget } from './fc-lab-types';

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
    delta7d: 6,
    competingSchools: [{ name: 'Tennessee', pct: 18 }],
  });
  const soft = target({
    slug: 'soft',
    name: 'Soft Lead',
    ufProbability: 36,
    delta7d: -2,
    competingSchools: [{ name: 'Georgia', pct: 30 }],
  });
  assert.equal(isFloridaLeadingOnBoard(closer), true);
  assert.equal(isNextCommitPick(closer), true);
  assert.ok(nextCommitScore(closer) > nextCommitScore(soft));
  assert.equal(isNextCommitPick(soft), false);
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
