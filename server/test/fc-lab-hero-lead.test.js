/**
 * Lab hero lead: never market elite-fit at single-digit Florida %.
 * Run: node server/test/fc-lab-hero-lead.test.js
 */
const assert = require('assert');

// Mirror client constants/helpers (avoid TS loader in this smoke test).
const LAB_HERO_ELITE_FIT_MIN = 80;
const LAB_HERO_ELITE_UF_FLOOR = 25;
const LAB_HERO_ELITE_UF_BAND = 15;
function ufPctFromFc(raw) {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n) : 0;
}
function isLabHeroEliteFit(target) {
  if (!target) return false;
  return (
    (target.fitScore ?? 0) >= LAB_HERO_ELITE_FIT_MIN &&
    ufPctFromFc(target.ufProbability) >= LAB_HERO_ELITE_UF_FLOOR
  );
}
function pickLabHeroLead(top10) {
  if (!top10.length) return null;
  const topByPriority = top10[0];
  const realUfPool = top10.filter((p) => ufPctFromFc(p.ufProbability) >= LAB_HERO_ELITE_UF_FLOOR);
  const base =
    ufPctFromFc(topByPriority.ufProbability) >= LAB_HERO_ELITE_UF_FLOOR || !realUfPool.length
      ? topByPriority
      : realUfPool[0];
  const elite = [...(realUfPool.length ? realUfPool : top10)]
    .filter((p) => (p.fitScore ?? 0) >= LAB_HERO_ELITE_FIT_MIN)
    .sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0))[0];
  if (
    elite &&
    ufPctFromFc(elite.ufProbability) >= ufPctFromFc(base.ufProbability) - LAB_HERO_ELITE_UF_BAND
  ) {
    return elite;
  }
  return base;
}

function main() {
  const top10 = [
    { slug: 'asher-ghioto', fitScore: 90, ufProbability: 8, position: 'EDGE' },
    { slug: 'tristian-henderson', fitScore: null, ufProbability: 24, position: 'EDGE' },
    { slug: 'joey-fleming', fitScore: null, ufProbability: 7, position: 'IOL' },
    { slug: 'izayah-vickers', fitScore: 38, ufProbability: 33, position: 'CB' },
    { slug: 'jermaine-cobbins', fitScore: 94, ufProbability: 7, position: 'CB' },
  ];
  const lead = pickLabHeroLead(top10);
  assert.strictEqual(lead.slug, 'izayah-vickers');
  assert.strictEqual(isLabHeroEliteFit(lead), false);
  assert.strictEqual(isLabHeroEliteFit(top10[0]), false);
  assert.strictEqual(isLabHeroEliteFit(top10[4]), false);

  const healthy = [
    { slug: 'a', fitScore: 70, ufProbability: 40, position: 'WR' },
    { slug: 'b', fitScore: 92, ufProbability: 38, position: 'EDGE' },
  ];
  const eliteLead = pickLabHeroLead(healthy);
  assert.strictEqual(eliteLead.slug, 'b');
  assert.strictEqual(isLabHeroEliteFit(eliteLead), true);
  console.log('fc-lab-hero-lead.test.js: PASS');
}
main();
