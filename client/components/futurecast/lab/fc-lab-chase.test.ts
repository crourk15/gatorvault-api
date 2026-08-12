import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildChaseWhy,
  buildChaseWhyBrief,
  chaseFightLine,
  chaseHeatLabel,
} from './chase-priority';
import type { FcLabTarget } from './fc-lab-types';

function target(
  partial: Partial<FcLabTarget> & Pick<FcLabTarget, 'slug' | 'name'>
): FcLabTarget {
  return {
    id: partial.slug,
    position: 'OL',
    school: 'Test HS',
    classYear: 2028,
    ufProbability: 28,
    delta7d: null,
    fitScore: 88,
    modelPct: null,
    stars: 4,
    predictors: [],
    competingSchools: [{ name: 'Georgia', pct: 34 }],
    priorityScore: 72,
    ...partial,
  };
}

test('chase heat formats priority score', () => {
  assert.equal(chaseHeatLabel(72.4), '72');
  assert.equal(chaseHeatLabel(null), '-');
});

test('buildChaseWhy prefers staff heat + thin room over odds alone', () => {
  const p = target({
    slug: 'lane-kid',
    name: 'Lane Kid',
    hotLanes: {
      staffHeat: 70,
      mustGetFit: 40,
      positionalNeed: 65,
      geoPipeline: 20,
      marketPressure: 10,
    },
    hotBadges: { staffAssigned: true, inState: true },
    visitLabels: ['OV booked'],
  });
  const why = buildChaseWhy(p);
  assert.ok(why.bullets.some((b) => /staff heat/i.test(b)));
  assert.ok(why.bullets.some((b) => /thin room/i.test(b)));
  assert.match(why.summary, /Staff heat|thin room/i);
});

test('buildChaseWhy falls back when lanes empty', () => {
  const p = target({
    slug: 'plain',
    name: 'Plain',
    hotLanes: null,
    notePreview: null,
    visitLabels: [],
    competingSchools: [],
    fitScore: 40,
  });
  const why = buildChaseWhy(p);
  assert.match(why.summary, /chase heat|priority/i);
});

test('chaseFightLine includes top rival', () => {
  const p = target({
    slug: 'fight',
    name: 'Fight',
    ufProbability: 28,
    competingSchools: [{ name: 'Georgia', pct: 40 }],
  });
  assert.match(chaseFightLine(p), /Georgia|UGA/i);
});

test('buildChaseWhyBrief is a chase reason, not a trait blurb', () => {
  const p = target({
    slug: 'tristian-henderson',
    name: 'Tristian Henderson',
    position: 'EDGE',
    school: 'Pine Forest (Pensacola, FL)',
    ufProbability: 28,
    fitScore: 76,
    priorityScore: 62,
    hotLanes: {
      positionalNeed: 88,
      mustGetFit: 70,
      staffHeat: 40,
      geoPipeline: 90,
      marketPressure: 50,
    },
    hotBadges: { inState: true },
    competingSchools: [{ name: 'Georgia Tech', pct: 27 }],
    notePreview: 'Henderson fits a bend-and-burst EDGE with first-step burst.',
  });
  const brief = buildChaseWhyBrief(p);
  assert.match(brief, /need|fit|fight|pipeline|chase/i);
  assert.doesNotMatch(brief, /first-step|bend-and-burst/i);
});
