/**
 * Bender-style teaser: Top-100 prospect + cousin of Lagonza Hayward + On3 article.
 * Run: node server/test/beat-teaser-resolve.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const gate = require('../lib/beat-recruiting-ingest-gate');
const teaser = require('../lib/beat-teaser-resolve');
const { parseBeatPostForVisitIntel } = require('../lib/beat-writer-ingest');
const { liveBeatInboxRows } = require('../lib/post-studio-intel-inbox');

const BENDER_TEXT =
  "Florida isn't just pushing hard for this Top-100 prospect.. The Gators also have a major connection in the building — his cousin and Florida safety Lagonza Hayward 👀 \"That's a very big factor.\"";

const ARTICLE =
  'https://www.on3.com/teams/florida-gators/news/new-on3-recruiting-prediction-machine-pick-for-florida-gators-8/';

const POST = {
  id: 'bender-cousin-teaser',
  text: BENDER_TEXT,
  handle: 'Corey_Bender',
  writerName: 'Corey Bender',
  outlet: 'On3 / Gators Online',
  url: 'https://x.com/Corey_Bender/status/1',
  publishedAt: new Date().toISOString(),
  attachmentUrls: [ARTICLE]
};

const MOCK_PROPS = {
  article: {
    title: 'New On3 Recruiting Prediction Machine pick for Florida',
    key: 'new-on3-recruiting-prediction-machine-pick-for-florida-gators-8',
    tags: [
      { slug: 'florida-gators', name: 'Florida Gators' },
      { slug: 'demetres-samuel-180242', name: 'Demetres Samuel (28 - ATH)' }
    ],
    featuredImage: {
      title: '2028 ATH Demetres Samuel',
      altText: '2028 ATH Demetres Samuel',
      caption: '@DemetresSamuel'
    }
  }
};

async function main() {
  assert.ok(teaser.isRelationalMention(BENDER_TEXT, 'Lagonza Hayward'), 'cousin name flagged');
  assert.equal(
    teaser.resolvePlayerFromBeatPostSync(POST),
    null,
    'sync must not resolve cousin as prospect'
  );

  const gateResult = gate.evaluateStrictRecruitingIngestGate(POST);
  assert.equal(gateResult.pass, true, `gate should pass teaser, got ${gateResult.reason}`);

  const resolved = await teaser.resolvePlayerFromBeatPost(POST, {
    fetchPageProps: async () => MOCK_PROPS
  });
  assert.equal(resolved?.playerSlug, 'demetres-samuel');
  assert.match(resolved.playerName, /Demetres Samuel/i);
  assert.ok(!/lagonza/i.test(resolved.playerName));

  const enriched = await teaser.enrichBeatPostIdentity(POST, {
    fetchPageProps: async () => MOCK_PROPS
  });
  assert.equal(enriched.enriched, true);
  const row = parseBeatPostForVisitIntel(enriched.post, { logSkips: false });
  assert.ok(row, 'ingest parses enriched Bender teaser');
  assert.match(String(row.playerName || ''), /Demetres/i);
  assert.ok(!/lagonza/i.test(String(row.playerName || '')));

  const cachePath = path.join(__dirname, '..', 'data', 'live', 'beat-cache.json');
  const original = fs.readFileSync(cachePath, 'utf8');
  try {
    fs.writeFileSync(
      cachePath,
      JSON.stringify({
        posts: [POST],
        fetchedAt: new Date().toISOString(),
        source: 'unit-test'
      })
    );
    const live = await liveBeatInboxRows({ maxAgeMs: 48 * 3600000 });
    assert.ok(
      live.rows.some((r) => /demetres/i.test(r.playerName || r.playerSlug || '')),
      'desk live inbox surfaces Demetres Samuel from On3 article'
    );
    assert.ok(live.rows.some((r) => r.teaserResolved), 'marked teaserResolved');
  } finally {
    fs.writeFileSync(cachePath, original);
  }

  console.log('beat-teaser-resolve.test.js PASS → Demetres Samuel');
}

main().catch((err) => {
  console.error('FAIL', err);
  process.exit(1);
});
