/**
 * Unresolved Predictions Queue — Pass 1 unit tests (no network).
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-upq-'));
const tmpFile = path.join(tmpDir, 'unresolved-predictions-queue.json');
process.env.GV_UNRESOLVED_PREDICTIONS_PATH = tmpFile;

const detect = require('../../lib/unresolved-predictions-detect');
const store = require('../../lib/unresolved-predictions-store');

function section(name) {
  console.log(`\n== ${name} ==`);
}

section('detect teaser Alderman RPM');
const teaserUrl =
  'https://on3.com/teams/florida-gators/news/predicting-the-florida-gators-to-land-a-4-star-defender-new-rpm/';
const teaserText =
  "NEW: The Gators have built early momentum for a 4-star defender — and we're dropping a prediction in their favor";
assert.strictEqual(detect.isTeaserOn3Url(teaserUrl), true);
assert.strictEqual(detect.isPredictionSignal({ text: teaserText, url: teaserUrl }), true);
assert.strictEqual(
  detect.shouldEnqueueUnresolvedPrediction({ text: teaserText, url: teaserUrl }),
  true
);

section('do not enqueue named allowlist prospects');
assert.strictEqual(
  detect.shouldEnqueueUnresolvedPrediction({
    text: 'RPM pick for Cyion Smith',
    playerSlug: 'cyion-smith',
  }),
  false
);

section('do not enqueue non-prediction skips');
assert.strictEqual(
  detect.shouldEnqueueUnresolvedPrediction({
    text: 'Florida hosting official visitors this weekend',
    url: 'https://on3.com/teams/florida-gators/news/florida-gators-hosting-final-batch-of-summer-official-visitors/',
  }),
  false
);

section('enqueue + dedupe + resolve');
const first = detect.safeEnqueueUnresolvedPrediction({
  reason: 'no_recruiting_identity',
  source: 'uf-on3-news-discovery',
  title: 'Predicting the Florida Gators to land a 4-star defender: New RPM',
  textPreview: teaserText,
  url: teaserUrl,
  handle: 'blake_alderman',
  writerName: 'Blake Alderman',
  fingerprint: 'test_cyion_teaser_rpm',
});
assert.strictEqual(first.enqueued, true);
assert.strictEqual(first.created, true);

const second = detect.safeEnqueueUnresolvedPrediction({
  reason: 'no_recruiting_identity',
  source: 'uf-on3-news-discovery',
  title: 'Predicting the Florida Gators to land a 4-star defender: New RPM',
  textPreview: teaserText,
  url: teaserUrl,
  handle: 'blake_alderman',
  fingerprint: 'test_cyion_teaser_rpm',
});
assert.strictEqual(second.enqueued, true);
assert.strictEqual(second.created, false);
assert.ok(second.item.seenCount >= 2);

const listed = store.listItems({ status: 'open' });
assert.strictEqual(listed.openCount, 1);
assert.strictEqual(listed.items[0].id, first.item.id);

const resolved = store.resolveItem(first.item.id, {
  playerSlug: 'cyion-smith',
  note: 'Blake Alderman RPM teaser',
});
assert.strictEqual(resolved.ok, true);
assert.strictEqual(resolved.item.status, 'resolved');
assert.strictEqual(resolved.item.resolvedPlayerSlug, 'cyion-smith');
assert.strictEqual(store.listItems({ status: 'open' }).openCount, 0);

section('dismiss path');
const d1 = store.enqueue({
  reason: 'no_identifiable_player',
  source: 'beat-writer-ingest',
  title: 'Crystal ball noise',
  text: 'crystal ball for a defender',
  url: 'https://example.com/cb',
  fingerprint: 'test_dismiss_cb',
});
const dismissed = store.dismissItem(d1.item.id, { note: 'not uf' });
assert.strictEqual(dismissed.ok, true);
assert.strictEqual(dismissed.item.status, 'dismissed');

console.log('\nAll unresolved-predictions tests passed.');
