/** Elite republish must rebuild ranking identity + elite_pr789 compose path. */
const test = require('node:test');
const assert = require('node:assert/strict');

const store = require('../../lib/recruiting-store');
const { buildEliteRepublishPost } = require('../../lib/player-intelligence/elite-republish-compose');
const intelStore = require('../../lib/recruiting-intel-store');

const SLUG = 'jermaine-cobbins';
const COBBINS_BEAT =
  "The Florida Gators' defensive back history and coaching staff continue standing out to one of the country's top 2028 prospects.";

test('elite republish composes ranking identity with composePath elite_pr789', async () => {
  const existing = await store.getPlayerBySlug(SLUG);
  assert.ok(existing, 'cobbins player row required');

  const patched = {
    ...existing,
    stars: 4,
    natlRank: 42,
    posRank: 4,
    stateRank: 1,
    hometownState: 'TN',
    pos: 'CB'
  };
  await store.upsertPlayer(patched);

  const doc = intelStore.loadIntelDoc();
  const items = [...(doc.items || [])];
  const probeId = 'test_cobbins_elite_republish_probe';
  const now = Date.now();
  const probe = {
    id: probeId,
    playerSlug: SLUG,
    playerName: 'Jermaine Cobbins',
    eventType: 'target_update',
    source: 'auto:on3-team-news',
    detail: COBBINS_BEAT,
    reportedAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
    ufRelevant: true,
    xPostQueued: false,
    xPosted: false,
    fingerprint: `${probeId}_fp`
  };
  intelStore.saveIntelDoc({ ...doc, items: [...items, probe] });

  try {
    const built = await buildEliteRepublishPost(SLUG, {
      intelRow: probe,
      refreshOn3: false,
      persistFusion: false
    });
    assert.equal(built.ok, true, built.reason || JSON.stringify(built));
    assert.equal(built.validationMeta?.composePath, 'elite_pr789');
    assert.match(built.text, /On3 No\. 42 natl/i);
    assert.match(built.text, /No\. 4 CB/i);
    assert.match(built.text, /DB tradition and staff pitch are standing out/i);
    assert.doesNotMatch(built.text, /campus in campus/i);
    assert.ok(built.validationMeta?.rankingTokens, 'rankingTokens missing');
    assert.ok(built.templateBlocks?.identity, 'identity block missing');
  } finally {
    intelStore.saveIntelDoc(doc);
    if (existing) await store.upsertPlayer(existing);
  }
});
