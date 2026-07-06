/** Republish clears sent/dedupe state so corrected Cobbins copy can enqueue. */
const test = require('node:test');
const assert = require('node:assert/strict');

const sentLedger = require('../../lib/x-autoposter-sent-ledger');
const storyMemory = require('../../lib/autoposter/story-memory');
const resolutionLedger = require('../../lib/autoposter/player-resolution-ledger');
const { republishPlayerIntel } = require('../../lib/x-autoposter-fill');
const intelStore = require('../../lib/recruiting-intel-store');

const SLUG = 'jermaine-cobbins';
const FP = 'test_cobbins_republish_fp';

test('republish clears ledgers and enqueues corrected Cobbins copy', async () => {
  const doc = intelStore.loadIntelDoc();
  const items = [...(doc.items || [])];
  const probeId = 'test_cobbins_republish_probe';
  const now = Date.now();
  const probe = {
    id: probeId,
    playerSlug: SLUG,
    playerName: 'Jermaine Cobbins',
    eventType: 'target_update',
    source: 'auto:on3-team-news',
    detail:
      "The Florida Gators' defensive back history and coaching staff continue standing out to one of the country's top 2028 prospects.",
    reportedAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
    ufRelevant: true,
    xPostQueued: false,
    xPosted: true,
    fingerprint: FP
  };

  intelStore.saveIntelDoc({ ...doc, items: [...items, probe] });
  resolutionLedger.markResolvedPublish(SLUG, {
    source: 'auto:on3-team-news',
    intelFingerprint: FP,
    preview: 'bad copy'
  });
  sentLedger.recordSentPost({
    status: 'sent',
    playerSlug: SLUG,
    intelFingerprint: FP,
    text: 'bad copy campus in campus',
    sentAt: new Date().toISOString(),
    tweetId: '111',
    source: 'test'
  });
  storyMemory.recordStoryUnit({
    playerSlug: SLUG,
    sourceEventType: 'target_update',
    text: 'bad copy',
    tweetId: '111',
    sentAt: new Date().toISOString()
  });

  try {
    const out = await republishPlayerIntel(SLUG, { fingerprint: FP, post: false });
    assert.equal(out.ok, true, out.error || JSON.stringify(out));
    assert.match(out.preview, /DB tradition and staff pitch are standing out/i);
    assert.doesNotMatch(out.preview, /campus in campus/i);
    assert.ok(out.enqueued?.id, 'queue item missing');
    assert.equal(out.enqueued.validationMeta?.allowRepublish, true);
    assert.equal(out.enqueued.validationMeta?.composePath, 'elite_pr789');

    const resolution = resolutionLedger.checkPlayerResolution(SLUG, { intelFingerprint: FP });
    assert.equal(resolution.blocked, false);

    const sentHit = sentLedger.hasRecentSentPost({ slug: SLUG, intelFingerprint: FP, text: out.preview });
    assert.equal(sentHit.hit, false);
  } finally {
    intelStore.saveIntelDoc(doc);
    resolutionLedger.clearPlayerResolution(SLUG);
    sentLedger.clearSentLedgerForPlayer(SLUG);
    storyMemory.clearStoryUnitsForPlayer(SLUG);
  }
});
