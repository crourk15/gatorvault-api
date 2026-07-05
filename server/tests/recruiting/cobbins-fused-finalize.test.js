/** Cobbins seam: fused beat intel must pass prepareNewsCandidate (QA + freshness). */
const test = require('node:test');
const assert = require('node:assert/strict');

const intelStore = require('../../lib/recruiting-intel-store');
const fill = require('../../lib/x-autoposter-fill');
const qa = require('../../lib/autoposter/recruiting-post-qa');

test('finalizeNewsCandidate accepts aged auto:on3-team-news fused beat intel', async () => {
  const doc = intelStore.loadIntelDoc();
  const items = [...(doc.items || [])];
  const now = Date.now();
  const probeId = 'test_cobbins_finalize_probe';
  const probe = {
    id: probeId,
    playerSlug: 'jermaine-cobbins',
    playerName: 'Jermaine Cobbins',
    eventType: 'target_update',
    source: 'auto:on3-team-news',
    detail:
      "The Florida Gators' defensive back history and coaching staff continue standing out for elite CB Jermaine Cobbins.",
    reportedAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
    ufRelevant: true,
    xPostQueued: false,
    xPosted: false,
    fingerprint: `${probeId}_fp`
  };

  intelStore.saveIntelDoc({ ...doc, items: [...items, probe] });
  try {
    const intel = intelStore.getIntelForPlayer({ playerSlug: 'jermaine-cobbins' }).find((r) => r.id === probeId);
    assert.ok(intel, 'probe intel row missing');
    const news = await fill.buildNewsFromIntel(intel);
    assert.ok(news?.text, news?.reason || 'buildNewsFromIntel returned no text');
    assert.equal(news.validationMeta?.fusedIntelCompose, true);
    const finalized = await fill.finalizeNewsCandidate(news);
    assert.ok(finalized, 'finalizeNewsCandidate returned null for fused Cobbins-class intel');
    assert.equal(qa.passesPublishGate(finalized), true, qa.rejectReason(finalized));
  } finally {
    intelStore.saveIntelDoc(doc);
  }
});
