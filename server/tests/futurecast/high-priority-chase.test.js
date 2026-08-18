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

  it('2028 high-priority payload keeps full allowlist so Closest to commit is system-driven', async () => {
    const {
      buildHighPriorityPayload,
      HIGH_PRIORITY_UNDERCLASSMEN_CHASE_LIMIT,
    } = require('../../api/futurecast/high-priority.ts');
    const payload = await buildHighPriorityPayload(2028);
    assert.ok(Array.isArray(payload.players));
    assert.ok(
      payload.players.length > HIGH_PRIORITY_UNDERCLASSMEN_CHASE_LIMIT,
      `expected full allowlist board, got ${payload.players.length}`
    );
    assert.ok(
      payload.players.some((p) => p.slug === 'hudson-west'),
      'Hudson West must stay in HP so Closest to commit updates from API without a client cut'
    );
    const byChase = [...payload.players].sort(
      (a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0)
    );
    const hudsonChaseRank = byChase.findIndex((p) => p.slug === 'hudson-west') + 1;
    assert.ok(
      hudsonChaseRank === 0 || hudsonChaseRank > HIGH_PRIORITY_UNDERCLASSMEN_CHASE_LIMIT,
      'Hudson is outside chase-hot top-N — proving the old slice would have dropped him'
    );
  });

  it('2028 HP cards surface visit lines + chase notes from intel (API-only)', async () => {
    const { buildHighPriorityPayload } = require('../../api/futurecast/high-priority.ts');
    const payload = await buildHighPriorityPayload(2028);
    const hudson = payload.players.find((p) => p.slug === 'hudson-west');
    assert.ok(hudson, 'Hudson West on board');
    assert.ok(
      Array.isArray(hudson.visitHistory) && hudson.visitHistory.length > 0,
      'Hudson must have visitHistory from FL UV logs / Expected merge'
    );
    assert.match(
      String(hudson.visitHistory.map((v) => v.label).join(' | ')),
      /UV|OV|Home visit|Expected/i
    );
    // Rising stays snapshot-driven — enrich must not invent movement.
    assert.ok(hudson.delta7d == null || Number.isFinite(Number(hudson.delta7d)));

    const withNotes = payload.players.filter((p) => String(p.notePreview || '').trim());
    assert.ok(
      withNotes.length >= 1,
      'at least one chase notePreview from profile/intel process language'
    );
  });
});
