/**
 * Pass 5 — golden never-late proof (no network).
 * Alderman On3 RPM teaser → Unresolved queue → pageProps identity → Cyion Smith → radar.
 * Asserts zero silent drops on nameless prediction URLs.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-never-late-'));
const queuePath = path.join(tmpDir, 'unresolved-predictions-queue.json');
const labPath = path.join(tmpDir, 'lab-promotions.json');
const allowlistPath = path.join(tmpDir, 'admin-allowlist.json');

process.env.GV_UNRESOLVED_PREDICTIONS_PATH = queuePath;
process.env.GV_LAB_PROMOTIONS_PATH = labPath;
process.env.GV_ADMIN_ALLOWLIST_PATH = allowlistPath;
process.env.GV_TEASER_IDENTITY_ENRICH = 'false';
process.env.ON3_RPM_FETCH = 'false';

fs.writeFileSync(allowlistPath, JSON.stringify({ version: 1, entries: [] }, null, 2));
fs.writeFileSync(labPath, JSON.stringify({ version: 1, lab: {}, watchlist: {} }, null, 2));

const fixture = require('../fixtures/on3-teaser-cyion-rpm-pageprops.json');
const detect = require('../../lib/unresolved-predictions-detect');
const store = require('../../lib/unresolved-predictions-store');
const identity = require('../../lib/teaser-rpm-identity');
const labPromotions = require('../../lib/lab-promotions-store');

const TEASER_URL =
  'https://www.on3.com/teams/florida-gators/news/predicting-the-florida-gators-to-land-a-4-star-defender-new-rpm/';
const TEASER_TEXT =
  "NEW: The Gators have built early momentum for a 4-star defender — and we're dropping a prediction in their favor";

function section(name) {
  console.log(`\n== ${name} ==`);
}

function fail(msg) {
  console.error('\nGOLDEN PROOF FAIL:', msg);
  process.exit(1);
}

(async () => {
  section('1) nameless teaser must NOT silent-skip');
  assert.strictEqual(detect.isTeaserOn3Url(TEASER_URL), true);
  assert.strictEqual(detect.isPredictionSignal({ text: TEASER_TEXT, url: TEASER_URL }), true);
  assert.strictEqual(
    detect.shouldEnqueueUnresolvedPrediction({ text: TEASER_TEXT, url: TEASER_URL }),
    true,
    'nameless prediction URL must enqueue'
  );
  // Named + attached prospect stays off the unresolved queue (Pass 1 rule).
  assert.strictEqual(
    detect.shouldEnqueueUnresolvedPrediction({
      text: 'RPM pick for Cyion Smith',
      playerSlug: 'cyion-smith',
    }),
    false
  );

  section('2) safeEnqueue opens Unresolved Predictions case');
  const enq = detect.safeEnqueueUnresolvedPrediction({
    reason: 'no_recruiting_identity',
    source: 'uf-on3-news-discovery',
    title: fixture.article.title,
    textPreview: TEASER_TEXT,
    url: TEASER_URL,
    handle: 'blake_alderman',
    writerName: 'Blake Alderman',
    fingerprint: 'golden_alderman_cyion_rpm_20260718',
  });
  assert.strictEqual(enq.enqueued, true);
  assert.strictEqual(enq.created, true);
  assert.ok(enq.item && enq.item.id);
  assert.strictEqual(store.listItems({ status: 'open' }).openCount, 1);

  section('3) pageProps identity resolves Cyion Smith (high)');
  const parsed = identity.resolveIdentityFromPageProps(fixture);
  assert.strictEqual(parsed.ok, true);
  assert.strictEqual(parsed.playerSlug, 'cyion-smith');
  assert.strictEqual(parsed.playerName, 'Cyion Smith');
  assert.strictEqual(parsed.classYear, 2028);
  assert.ok(parsed.twitterHandles.includes('cyionsmith5'));
  assert.strictEqual(parsed.confidence, 'high');

  section('4) enrich auto-resolves + promotes to radar (dryRun)');
  const enriched = await identity.enrichUnresolvedPredictionItem(enq.item, {
    autoResolve: true,
    minConfidence: 'high',
    fetchPageProps: async () => fixture,
    fetchRpm: false,
    dryRunRadar: true,
  });
  assert.strictEqual(enriched.enriched, true);
  assert.strictEqual(enriched.autoResolved, true);
  assert.strictEqual(enriched.identity.playerSlug, 'cyion-smith');
  assert.strictEqual(enriched.identity.playerName, 'Cyion Smith');
  assert.ok(enriched.radar && enriched.radar.ok === true, 'radar promote must succeed');
  assert.strictEqual(enriched.radar.dryRun, true);
  assert.ok(
    enriched.radar.stage === 'lab' || enriched.radar.stage === 'watchlist',
    `expected lab|watchlist, got ${enriched.radar.stage}`
  );
  assert.strictEqual(enriched.radar.row.slug, 'cyion-smith');
  assert.ok(
    (enriched.radar.row.reasons || []).includes('on3_rpm'),
    'radar reasons must include on3_rpm'
  );

  section('5) queue has zero open cases (no silent orphan)');
  const open = store.listItems({ status: 'open' });
  assert.strictEqual(open.openCount, 0, 'open queue must be empty after auto-resolve');
  const resolved = store.listItems({ status: 'resolved' });
  assert.ok(resolved.items.some((it) => it.resolvedPlayerSlug === 'cyion-smith'));

  section('6) promoteResolvedPredictionToRadar dryRun stage for Cyion');
  const { promoteResolvedPredictionToRadar } = require('../../lib/lab-intel-promote');
  const radar = await promoteResolvedPredictionToRadar({
    slug: 'cyion-smith',
    name: 'Cyion Smith',
    classYear: 2028,
    reasons: ['on3_rpm', 'teaser_identity'],
    sources: ['on3_rpm', 'teaser_identity'],
    fetchRpm: false,
    dryRun: true,
  });
  assert.strictEqual(radar.ok, true);
  assert.strictEqual(radar.dryRun, true);
  // Visit log in inventory → Lab; otherwise watchlist. Either is "on radar".
  assert.ok(radar.stage === 'lab' || radar.stage === 'watchlist');
  assert.strictEqual(radar.row.slug, 'cyion-smith');

  // Store path wiring still points at temp lab file (no accidental bundle writes).
  assert.ok(String(labPromotions.STORE_PATH).includes('gv-never-late-'));

  console.log('\nGOLDEN PROOF PASS: Alderman teaser → Cyion Smith → radar (zero silent drops)');
  console.log(JSON.stringify({
    ok: true,
    playerSlug: 'cyion-smith',
    stage: radar.stage,
    openCount: store.listItems({ status: 'open' }).openCount,
    silentDrop: false,
  }));
})().catch((err) => {
  fail(err && err.stack ? err.stack : String(err));
});
