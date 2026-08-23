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
  assert.match(brief, /Thin EDGE room \+ Fit 76|need|fit|fight|pipeline|chase/i);
  assert.doesNotMatch(brief, /first-step|bend-and-burst/i);
});

test('buildChaseWhyBrief includes Expected visit labels on the skinny', () => {
  const p = target({
    slug: 'brysen-wright',
    name: 'Brysen Wright',
    position: 'WR',
    school: 'Mandarin (Jacksonville, FL)',
    ufProbability: 22,
    fitScore: 84,
    visitLabels: ['Expected Ole Miss visit · Sep 26'],
    competingSchools: [{ name: 'Miami', pct: 38 }],
  });
  const brief = buildChaseWhyBrief(p);
  assert.match(brief, /Expected Ole Miss visit · Sep 26/);
});

test('buildChaseWhyBrief wires process notePreview, not film traits', () => {
  const p = target({
    slug: 'chris-morillo',
    name: 'Chris Morillo',
    position: 'ATH',
    school: 'Hudson (Hudson, FL)',
    ufProbability: 28,
    fitScore: 72,
    hotLanes: {
      staffHeat: 60,
      mustGetFit: 40,
      positionalNeed: 30,
      geoPipeline: 70,
      marketPressure: 20,
    },
    hotBadges: { inState: true, staffAssigned: true },
    competingSchools: [{ name: 'Florida State', pct: 34 }],
    notePreview: 'Florida offered · June 15 UOV on file',
    visitLabels: [],
  });
  const brief = buildChaseWhyBrief(p);
  assert.match(brief, /Florida offer on file|Florida offered|UOV on file/i);
  assert.ok(brief.length <= 180, `brief too long: ${brief.length}`);
});

test('buildChaseWhyBrief never dumps mid-sentence visit prose with …', () => {
  const p = target({
    slug: 'brysen-wright',
    name: 'Brysen Wright',
    position: 'WR',
    school: 'Mandarin (Jacksonville, FL)',
    ufProbability: 16,
    fitScore: 68,
    hotLanes: null,
    hotBadges: { inState: true },
    competingSchools: [{ name: 'Miami', pct: 38 }],
    notePreview:
      'Brysen Wright has visited Florida previously this offseason and is expected to return for a game',
    visitLabels: [],
  });
  const brief = buildChaseWhyBrief(p);
  assert.doesNotMatch(brief, /and is…|and is\.\.\.|offseason and is/i);
  assert.match(brief, /UF visit already on file|UOV on file|OV on file/i);
});

test('buildChaseWhyBrief combines thin room + fit when both fire', () => {
  const p = target({
    slug: 'edge-need',
    name: 'Edge Need',
    position: 'EDGE',
    ufProbability: 18,
    fitScore: 78,
    hotLanes: {
      positionalNeed: 90,
      mustGetFit: 55,
      staffHeat: 20,
      geoPipeline: 10,
      marketPressure: 10,
    },
    competingSchools: [{ name: 'Miami', pct: 40 }],
    notePreview: null,
    visitLabels: [],
  });
  const brief = buildChaseWhyBrief(p);
  assert.match(brief, /Thin EDGE room \+ Fit 78/);
});

test('buildChaseWhyBrief does not force need when the room is loaded', () => {
  const p = target({
    slug: 'brysen-wright',
    name: 'Brysen Wright',
    position: 'WR',
    school: 'Mandarin (Jacksonville, FL)',
    stars: 5,
    nationalRank: 3,
    ufProbability: 16,
    fitScore: 84,
    hotLanes: {
      positionalNeed: 28,
      mustGetFit: 60,
      staffHeat: 40,
      geoPipeline: 80,
      marketPressure: 30,
    },
    hotBadges: { inState: true },
    competingSchools: [{ name: 'Miami', pct: 38 }],
    notePreview: null,
    visitLabels: [],
  });
  const brief = buildChaseWhyBrief(p);
  assert.doesNotMatch(brief, /Thin WR room|position of need|fills a thin/i);
  assert.match(brief, /still chases even with the room set/i);
  assert.match(brief, /Top-10 WR|Five-star|Mandarin|Jacksonville/i);
});

test('buildChaseWhyBrief never says backyard', () => {
  const p = target({
    slug: 'jax-wr',
    name: 'Jax WR',
    position: 'WR',
    school: 'Mandarin (Jacksonville, FL)',
    stars: 4,
    ufProbability: 22,
    fitScore: 70,
    hotLanes: {
      positionalNeed: 20,
      mustGetFit: 30,
      staffHeat: 20,
      geoPipeline: 90,
      marketPressure: 10,
    },
    hotBadges: { inState: true },
    competingSchools: [{ name: 'Miami', pct: 40 }],
    notePreview: null,
    visitLabels: [],
  });
  const brief = buildChaseWhyBrief(p);
  assert.doesNotMatch(brief, /backyard/i);
  assert.match(brief, /Mandarin|Jacksonville|in-state|keep warm/i);
});

test('buildChaseWhyBrief still claims thin room when need is real', () => {
  const p = target({
    slug: 'true-need',
    name: 'True Need',
    position: 'OT',
    school: 'Plant (Tampa, FL)',
    stars: 4,
    ufProbability: 24,
    fitScore: 79,
    hotLanes: {
      positionalNeed: 72,
      mustGetFit: 50,
      staffHeat: 25,
      geoPipeline: 70,
      marketPressure: 15,
    },
    hotBadges: { inState: true },
    competingSchools: [{ name: 'Georgia', pct: 36 }],
    notePreview: null,
    visitLabels: [],
  });
  const brief = buildChaseWhyBrief(p);
  assert.match(brief, /Thin OT room \+ Fit 79/);
});
