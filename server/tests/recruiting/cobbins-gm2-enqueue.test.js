const test = require('node:test');
const assert = require('node:assert/strict');

test('GM2 autoposter allows PR-789 fused Cobbins despite short rewrite blocks', async () => {
  const fill = require('../../lib/x-autoposter-fill');
  const intelStore = require('../../lib/recruiting-intel-store');
  const gm2 = require('../../lib/gm2');
  const rules = require('../../lib/gm2/rules-engine');

  await intelStore.initIntelStore();
  const row = intelStore
    .getIntelForPlayer({ playerSlug: 'jermaine-cobbins' })
    .find((r) => r.source === 'auto:on3-team-news');
  assert.ok(row, 'Cobbins On3 intel row required');

  const built = await fill.buildNewsFromIntel(row);
  assert.ok(built, 'buildNewsFromIntel should succeed');
  const finalized = await fill.finalizeNewsCandidate(built);
  assert.ok(finalized, 'finalizeNewsCandidate should succeed');

  const gate = rules.rulesForAutoposter(finalized);
  assert.equal(gate.allow, true, gate.reason || 'expected GM2 allow');
  assert.equal(gm2.filterAutoposterCandidate(finalized), true);
});
