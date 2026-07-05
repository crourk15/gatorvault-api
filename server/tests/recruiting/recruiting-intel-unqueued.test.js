/** getUnqueuedIntel must not drop beat rows outside the global top-50 recency window. */
const test = require('node:test');
const assert = require('node:assert/strict');

const intelStore = require('../../lib/recruiting-intel-store');

test('getUnqueuedIntel includes aged beat intel beyond global top-50 recency', () => {
  const doc = intelStore.loadIntelDoc();
  const items = [...(doc.items || [])];
  const now = Date.now();
  const filler = [];
  for (let i = 0; i < 60; i += 1) {
    filler.push({
      id: `test_filler_${i}`,
      playerSlug: `filler-player-${i}`,
      playerName: `Filler Player ${i}`,
      eventType: 'target_update',
      source: 'auto:on3-team-news',
      detail: 'Florida recruiting filler intel row.',
      reportedAt: new Date(now - i * 60 * 1000).toISOString(),
      createdAt: new Date(now - i * 60 * 1000).toISOString(),
      ufRelevant: true,
      xPostQueued: false,
      xPosted: false
    });
  }
  const cobbins = {
    id: 'test_cobbins_unqueued_probe',
    playerSlug: 'jermaine-cobbins',
    playerName: 'Jermaine Cobbins',
    eventType: 'target_update',
    source: 'auto:on3-team-news',
    detail: "The Florida Gators' defensive back history and coaching staff continue standing out.",
    reportedAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
    ufRelevant: true,
    xPostQueued: false,
    xPosted: false,
    fingerprint: 'test_cobbins_unqueued_probe_fp'
  };

  intelStore.saveIntelDoc({ ...doc, items: [...filler, cobbins] });
  try {
    const rows = intelStore.getUnqueuedIntel({ maxAgeMs: 21 * 24 * 60 * 60 * 1000 });
    assert.ok(
      rows.some((row) => row.id === cobbins.id),
      `expected Cobbins probe row in unqueued set (${rows.length} rows)`
    );
  } finally {
    intelStore.saveIntelDoc(doc);
  }
});
