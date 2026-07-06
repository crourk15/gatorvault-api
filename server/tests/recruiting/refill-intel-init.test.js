const test = require('node:test');
const assert = require('node:assert/strict');

test('refillAutoposterQueue hydrates intel store before collecting candidates', async () => {
  const intelStore = require('../../lib/recruiting-intel-store');
  const fill = require('../../lib/x-autoposter-fill');

  let initCalls = 0;
  const originalInit = intelStore.initIntelStore;
  intelStore.initIntelStore = async () => {
    initCalls += 1;
    return originalInit();
  };

  try {
    await fill.refillAutoposterQueue({ minPending: 0, maxEnqueue: 0 });
    assert.ok(initCalls >= 1, 'refill must await initIntelStore');
  } finally {
    intelStore.initIntelStore = originalInit;
  }
});

test('forcePost intel build surfaces Cobbins after init', async () => {
  const intelStore = require('../../lib/recruiting-intel-store');
  const fill = require('../../lib/x-autoposter-fill');

  await intelStore.initIntelStore();
  const beatIntel = intelStore
    .getUnqueuedIntel({ maxAgeMs: fill.FORCE_POST_COMMIT_AGE_MS })
    .filter(fill.isBeatWriterIntel);
  const scan = await fill.selectBeatIntelForAutopost(beatIntel, { limit: 12 });
  const built = await fill.buildCandidatesFromIntelRows(scan, { maxBuild: 6 });
  assert.ok(
    built.some((row) => row.playerSlug === 'jermaine-cobbins'),
    'forcePost-age intel build should surface Cobbins On3 row'
  );
});

test('collectPriorityBeatIntelCandidate surfaces Cobbins beat row', async () => {
  const intelStore = require('../../lib/recruiting-intel-store');
  const fill = require('../../lib/x-autoposter-fill');

  await intelStore.initIntelStore();
  const row = await fill.collectPriorityBeatIntelCandidate({ forcePost: true });
  assert.ok(row, 'priority beat intel build required');
  assert.equal(row.playerSlug, 'jermaine-cobbins');
});
