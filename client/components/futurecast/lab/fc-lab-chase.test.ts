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
  assert.ok(why.bullets.some((b) => /staff|thin room|must-get|pipeline/i.test(b)));
  assert.doesNotMatch(why.summary, /from /i);
});

test('buildChaseWhyBrief prefers live API whyWeChase over generate', () => {
  const p = target({
    slug: 'izayah-vickers',
    name: 'Izayah Vickers',
    position: 'CB',
    whyWeChase: 'Charles override — Vickers stays #1 for staff lock.',
    ufRpmPct: 94,
    school: 'Florida State Univ. School (Tallahassee, FL)',
  });
  const brief = buildChaseWhyBrief(p, { chaseRank: 1 });
  assert.equal(brief, 'Charles override — Vickers stays #1 for staff lock.');
  assert.doesNotMatch(brief, /Tallahassee|not because/i);
});

test('buildChaseWhyBrief explains #1 chase with board ownership (Vickers) — no hometown', () => {
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
  assert.match(brief, /owns this CB|already ahead on Vickers|staff is locked on Vickers/i);
  assert.doesNotMatch(brief, /from Tallahassee|not because|Thin CB room Florida has to fill|94%|Staff 52/i);
  assert.ok(brief.length <= 280, `brief too long: ${brief.length} — ${brief}`);
});

test('buildChaseWhyBrief explains late-board without hometown or score dump', () => {
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
  assert.match(brief, /Evans|live fight|still on the chase|still on the board/i);
  assert.doesNotMatch(brief, /from |Tallahassee|Thin WR room|#43|34%/i);
});

test('buildChaseWhyBrief uses ufRpmPct ownership, not raw ufProbability', () => {
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
  assert.match(brief, /owns this CB|already ahead on Kid|staff is locked/i);
  assert.doesNotMatch(brief, /11%|88%/);
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
  assert.doesNotMatch(brief, /backyard|from Mandarin|from Jacksonville|not because/i);
  assert.match(brief, /WR|chase|fight/i);
});

test('buildChaseWhyBrief can mention real trench gap without score dump', () => {
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
      staffHeat: 70,
      geoPipeline: 10,
      marketPressure: 10,
    },
    competingSchools: [{ name: 'Miami', pct: 40 }],
    notePreview: null,
    visitLabels: [],
  });
  const brief = buildChaseWhyBrief(p, { chaseRank: 11 });
  assert.match(brief, /trench room is thin|edge/i);
  assert.doesNotMatch(brief, /^Thin EDGE room|Fit 78|90%/);
});

test('chaseFightLine still surfaces odds for race chrome', () => {
  const p = target({
    slug: 'fight',
    name: 'Fight Kid',
    ufProbability: 40,
    competingSchools: [{ name: 'Miami', pct: 48 }],
  });
  assert.match(chaseFightLine(p), /Florida/);
});
