const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require('tsx/cjs');

describe('Lab High Priority uses staff-chase ranking', () => {
  it('high-priority module applies hottest-target scores before sort', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'api', 'futurecast', 'high-priority.ts'),
      'utf8'
    );
    assert.match(src, /applyChasePriorityScores/);
    assert.match(src, /scoreHotTargetBoard/);
    assert.match(src, /hot-florida-targets/);
    assert.doesNotMatch(
      src,
      /ufProbability \* 0\.55 \+ fitScore \* 0\.3/
    );
    assert.doesNotMatch(
      src,
      /ufProbability \* 0\.5 \+\s*\n\s*fitScore \* 0\.2/
    );
  });

  it('2028 discovery board ranks staff-side chase over bare high UF fit', async () => {
    const { buildChaseFeatureIndex, computeChaseScore } = require('../../lib/uf-chase-score');
    const index = buildChaseFeatureIndex({ classYear: 2028 });
    const highFit = computeChaseScore(
      { slug: 'kaydan-whiteside', ufFitScore: 95, uf_status: 'TARGET' },
      index
    );
    const staffChase = computeChaseScore(
      { slug: 'braxton-rein', ufFitScore: 40, uf_status: 'TARGET' },
      index
    );
    assert.ok(
      staffChase.chaseScore > highFit.chaseScore,
      'staff-side chase must outrank high-fit / low-pursuit peer'
    );
  });
});
