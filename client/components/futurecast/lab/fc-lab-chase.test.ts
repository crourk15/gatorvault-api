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
    position: 'EDGE',
    hotLanes: {
      staffHeat: 70,
      mustGetFit: 40,
      positionalNeed: 95,
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

test('buildChaseWhyBrief explains #1 chase with talent + board ownership (Vickers)', () => {
  const p = target({
    slug: 'izayah-vickers',
    name: 'Izayah Vickers',
    position: 'CB',
    school: 'Florida State Univ. School (Tallahassee, FL)',
    stars: 4,
    nationalRank: 117,
    ufProbability: 42,
    ufRpmPct: 94,
    fitScore: 87,
    priorityScore: 61,
    hotLanes: {
      staffHeat: 52,
      mustGetFit: 53,
      positionalNeed: 88,
      geoPipeline: 95,
      marketPressure: 35,
    },
    hotBadges: { inState: true, staffAssigned: true, quietChase: true },
    competingSchools: [],
    notePreview: null,
    visitLabels: [],
  });
  const brief = buildChaseWhyBrief(p, { chaseRank: 1 });
  assert.match(brief, /Four-star CB|#117|nationally/i);
  assert.match(brief, /owns the On3 board|#1 on Priority Chase/i);
  assert.match(brief, /94%/);
  assert.doesNotMatch(brief, /from Tallahassee|Thin CB room Florida has to fill/i);
  assert.ok(brief.length <= 180, `brief too long: ${brief.length} — ${brief}`);
});

test('buildChaseWhyBrief explains late-board rank without hometown as the reason', () => {
  const p = target({
    slug: 'pj-evans',
    name: 'PJ Evans',
    position: 'WR',
    school: 'Out of state HS',
    stars: 3,
    nationalRank: 384,
    ufProbability: 34,
    ufRpmPct: 34,
    fitScore: 55,
    priorityScore: 43,
    hotLanes: {
      staffHeat: 41,
      mustGetFit: 19,
      positionalNeed: 62,
      geoPipeline: 15,
      marketPressure: 75,
    },
    hotBadges: { staffAssigned: true },
    competingSchools: [{ name: 'Miami', pct: 40 }],
    notePreview: null,
    visitLabels: [],
  });
  const brief = buildChaseWhyBrief(p, { chaseRank: 43 });
  assert.match(brief, /#43/);
  assert.match(brief, /Three-star WR|staff/i);
  assert.doesNotMatch(brief, /from |Tallahassee|Thin WR room/i);
});

test('buildChaseWhyBrief prefers ufRpmPct over raw ufProbability', () => {
  const p = target({
    slug: 'rpm-kid',
    name: 'Rpm Kid',
    position: 'CB',
    stars: 4,
    nationalRank: 90,
    ufProbability: 11,
    ufRpmPct: 88,
    fitScore: 80,
    priorityScore: 58,
    hotBadges: { staffAssigned: true },
    competingSchools: [],
    notePreview: null,
    visitLabels: [],
  });
  const brief = buildChaseWhyBrief(p, { chaseRank: 2 });
  assert.match(brief, /88%/);
  assert.doesNotMatch(brief, /sits at 11%|11%/);
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
  const brief = buildChaseWhyBrief(p, { chaseRank: 8 });
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
  const brief = buildChaseWhyBrief(p, { chaseRank: 12 });
  assert.match(brief, /Florida offer on file|Florida offered|UOV on file/i);
  assert.doesNotMatch(brief, /from Hudson/i);
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
  const brief = buildChaseWhyBrief(p, { chaseRank: 9 });
  assert.doesNotMatch(brief, /and is…|and is\.\.\.|offseason and is/i);
  assert.match(brief, /UF visit already on file|UOV on file|OV on file/i);
});

test('buildChaseWhyBrief never leads with hometown / backyard', () => {
  const p = target({
    slug: 'jax-wr',
    name: 'Jax WR',
    position: 'WR',
    school: 'Mandarin (Jacksonville, FL)',
    stars: 4,
    nationalRank: 140,
    ufProbability: 22,
    fitScore: 70,
    priorityScore: 50,
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
  const brief = buildChaseWhyBrief(p, { chaseRank: 18 });
  assert.doesNotMatch(brief, /backyard|from Mandarin|from Jacksonville/i);
  assert.match(brief, /Four-star WR|#18/i);
});

test('buildChaseWhyBrief can mention real trench gap as support, not the whole answer', () => {
  const p = target({
    slug: 'edge-need',
    name: 'Edge Need',
    position: 'EDGE',
    stars: 4,
    nationalRank: 95,
    ufProbability: 18,
    ufRpmPct: 18,
    fitScore: 78,
    priorityScore: 55,
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
  const brief = buildChaseWhyBrief(p, { chaseRank: 11 });
  assert.match(brief, /Four-star EDGE|#95|#11/i);
  assert.match(brief, /real EDGE room gap|Fit 78|chase/i);
  assert.doesNotMatch(brief, /^Thin EDGE room/);
});
