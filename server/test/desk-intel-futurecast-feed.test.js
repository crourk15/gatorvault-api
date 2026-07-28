/**
 * Desk intel → FutureCast feed.
 * Run: node server/test/desk-intel-futurecast-feed.test.js
 */
const assert = require('assert');
const {
  decideTargetingPct,
  shouldPromoteToFutureCast,
  floridaOfferedOnPlayer,
  feedDeskIntelToFutureCast
} = require('../lib/desk-intel-futurecast-feed');

function mainSync() {
  const seed = decideTargetingPct({
    isNew: true,
    on3RpmPct: 36,
    floridaOffered: true
  });
  assert.strictEqual(seed.pct, 36);
  assert.ok(seed.nudged);

  const locked = decideTargetingPct({
    priorPct: 40,
    on3RpmPct: 55,
    rivalsLocked: true
  });
  assert.strictEqual(locked.source, 'rivals_pm_locked');
  assert.strictEqual(locked.pct, 40);
  assert.ok(!locked.nudged);

  const blend = decideTargetingPct({
    priorPct: 20,
    on3RpmPct: 36,
    floridaOffered: true,
    signalType: 'trending'
  });
  // Florida offer → catch up to On3 (up to +20 / feed)
  assert.strictEqual(blend.pct, 36);

  const step = decideTargetingPct({
    priorPct: 20,
    on3RpmPct: 50,
    floridaOffered: false,
    signalType: 'trending'
  });
  // max step 5 for trending without offer catch-up
  assert.strictEqual(step.pct, 25);

  const bump = decideTargetingPct({
    priorPct: 30,
    on3RpmPct: null,
    signalType: 'trending'
  });
  assert.strictEqual(bump.pct, 33);

  const player = {
    name: 'Nick Carroll',
    classYear: 2028,
    on3Slug: 'nick-carroll-281042',
    ufRpmPct: 36,
    ufStatus: 'Florida Offered',
    on3TopTeams: [
      { team: { name: 'Florida' }, status: 'Offered', prediction: 36, year: 2028, unOfficialVisitCount: 2 }
    ]
  };
  assert.ok(floridaOfferedOnPlayer(player));
  assert.ok(shouldPromoteToFutureCast(player, 2028));
  assert.ok(!shouldPromoteToFutureCast(player, 2027));

  console.log('sync asserts PASS');
}

async function mainLive() {
  const dry = await feedDeskIntelToFutureCast({
    slug: 'nick-carroll',
    forceHydrate: true,
    dryRun: true,
    signalType: 'trending'
  });
  assert.ok(dry.ok, JSON.stringify(dry));
  assert.ok(dry.promote || dry.allowlisted || dry.decision?.pct > 0, JSON.stringify(dry));
  assert.ok(dry.patchPreview?.natlRank != null || dry.decision?.pct === 36, JSON.stringify(dry.patchPreview));
  console.log('dry-run', {
    promote: dry.promote,
    decision: dry.decision,
    patch: dry.patchPreview
  });

  // Live write (local store) — brand new or refresh
  const live = await feedDeskIntelToFutureCast({
    slug: 'nick-carroll',
    forceHydrate: true,
    signalType: 'trending'
  });
  assert.ok(live.ok, JSON.stringify(live));
  assert.ok(live.decision?.pct >= 30, JSON.stringify(live.decision));
  assert.ok(
    live.steps.some((s) => s.step === 'recruiting_store_upsert' && s.ok),
    JSON.stringify(live.steps)
  );
  assert.ok(
    live.steps.some((s) => s.step === 'early_watchlist' && s.ok),
    JSON.stringify(live.steps)
  );

  const store = require('../lib/recruiting-store');
  const saved = await store.getPlayerBySlug('nick-carroll');
  assert.ok(saved, 'player persisted');
  assert.ok(saved.natlRank === 70 || saved.ufRpmPct >= 30, JSON.stringify({
    natlRank: saved.natlRank,
    ufRpmPct: saved.ufRpmPct,
    ufProbability: saved.ufProbability
  }));
  assert.ok(saved.htWt || saved.height, 'measurements persisted');
  console.log('live feed OK', {
    isNew: live.isNew,
    promoted: live.promoted,
    allowlisted: live.allowlisted,
    pct: live.decision?.pct,
    natlRank: saved.natlRank,
    htWt: saved.htWt
  });

  // Existing path: second call should refresh / nudge, not fail
  const again = await feedDeskIntelToFutureCast({
    slug: 'nick-carroll',
    forceHydrate: true,
    signalType: 'trending'
  });
  assert.ok(again.ok);
  assert.ok(!again.isNew);
  console.log('refresh OK', again.decision);

  console.log('desk-intel-futurecast-feed.test.js PASS');
}

mainSync();
mainLive().catch((err) => {
  console.error('FAIL', err);
  process.exit(1);
});
