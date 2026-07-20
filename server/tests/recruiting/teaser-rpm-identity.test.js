/**
 * Pass 2 — teaser RPM identity resolver (fixture, no network).
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-teaser-'));
const tmpFile = path.join(tmpDir, 'unresolved-predictions-queue.json');
process.env.GV_UNRESOLVED_PREDICTIONS_PATH = tmpFile;
process.env.GV_TEASER_IDENTITY_ENRICH = 'false'; // keep enqueue sync in detect tests

const fixture = require('../fixtures/on3-teaser-cyion-rpm-pageprops.json');
const identity = require('../../lib/teaser-rpm-identity');
const detect = require('../../lib/unresolved-predictions-detect');
const store = require('../../lib/unresolved-predictions-store');

function section(name) {
  console.log(`\n== ${name} ==`);
}

section('parse featured image + tags from Cyion teaser fixture');
const parsed = identity.resolveIdentityFromPageProps(fixture);
assert.strictEqual(parsed.ok, true);
assert.strictEqual(parsed.playerSlug, 'cyion-smith');
assert.strictEqual(parsed.playerName, 'Cyion Smith');
assert.strictEqual(parsed.classYear, 2028);
assert.ok(parsed.twitterHandles.includes('cyionsmith5'));
assert.strictEqual(parsed.confidence, 'high');

section('fetch wrapper uses injected pageProps');
(async () => {
  const fromUrl = await identity.resolveIdentityFromOn3ArticleUrl(
    'https://www.on3.com/teams/florida-gators/news/predicting-the-florida-gators-to-land-a-4-star-defender-new-rpm/',
    { fetchPageProps: async () => fixture }
  );
  assert.strictEqual(fromUrl.playerSlug, 'cyion-smith');

  section('enrich auto-resolves high confidence open case');
  const enq = store.enqueue({
    reason: 'no_recruiting_identity',
    source: 'uf-on3-news-discovery',
    title: fixture.article.title,
    textPreview: 'dropping a prediction in their favor',
    url: 'https://www.on3.com/teams/florida-gators/news/predicting-the-florida-gators-to-land-a-4-star-defender-new-rpm/',
    handle: 'blake_alderman',
    fingerprint: 'test_teaser_cyion_pass2',
  });
  assert.strictEqual(enq.created, true);

  const enriched = await identity.enrichUnresolvedPredictionItem(enq.item, {
    autoResolve: true,
    minConfidence: 'high',
    fetchPageProps: async () => fixture,
  });
  assert.strictEqual(enriched.enriched, true);
  assert.strictEqual(enriched.autoResolved, true);
  assert.strictEqual(enriched.identity.playerSlug, 'cyion-smith');
  assert.strictEqual(store.listItems({ status: 'open' }).openCount, 0);

  section('detect still recognizes teaser signal');
  assert.strictEqual(
    detect.isTeaserOn3Url(
      'https://on3.com/teams/florida-gators/news/predicting-the-florida-gators-to-land-a-4-star-defender-new-rpm/'
    ),
    true
  );

  console.log('\nAll teaser-rpm-identity tests passed.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
