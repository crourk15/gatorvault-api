/**
 * Blake Alderman fresh offer: Chase Foster II + coach relationship must stay OFFER.
 * Run: node server/test/beat-offer-alderman-foster.test.js
 */
const assert = require('assert');
const { isFreshOfferBeat, isRetrospectiveOfferBeat } = require('../lib/autoposter/recruiting-offer-disambiguation');
const { parseBeatPostForVisitIntel, resolveRecruitingEventType } = require('../lib/beat-writer-ingest');
const { liveBeatInboxRows } = require('../lib/post-studio-intel-inbox');
const fs = require('fs');
const path = require('path');

const FOSTER =
  'Florida has offered 4-star DL Chase Foster II of IMG Academy. The Gators have quickly climbed his board. He already has a relationship with Florida DL coach Gerald Chatman.';

const POST = {
  id: 'alderman-foster-offer',
  text: FOSTER,
  handle: 'Blake_Alderman',
  writerName: 'Blake Alderman',
  outlet: 'Gators Online / On3',
  url: 'https://x.com/Blake_Alderman/status/1',
  publishedAt: new Date().toISOString(),
  attachmentUrls: [
    'https://www.on3.com/teams/florida-gators/news/florida-offers-4-star-dl-chase-foster-ii/'
  ]
};

async function main() {
  assert.equal(isFreshOfferBeat(FOSTER), true);
  assert.equal(isRetrospectiveOfferBeat(FOSTER), false);
  assert.equal(resolveRecruitingEventType(FOSTER), 'offer');

  const row = parseBeatPostForVisitIntel(POST, { logSkips: false });
  assert.ok(row, 'row parsed');
  assert.equal(row.eventType, 'offer');
  assert.match(row.playerName, /Chase Foster II/i);
  assert.equal(row.playerSlug, 'chase-foster-ii');
  assert.equal(row.pos, 'DL');
  assert.equal(row.stars, 4);
  assert.match(String(row.school || row.highSchool || ''), /IMG/i);
  assert.ok(row.articleUrl && /on3\.com/i.test(row.articleUrl));

  const cachePath = path.join(__dirname, '..', 'data', 'live', 'beat-cache.json');
  const original = fs.readFileSync(cachePath, 'utf8');
  try {
    fs.writeFileSync(
      cachePath,
      JSON.stringify({ posts: [POST], fetchedAt: new Date().toISOString(), source: 'unit-test' })
    );
    const live = await liveBeatInboxRows({ maxAgeMs: 48 * 3600000 });
    assert.ok(
      live.rows.some((r) => r.playerSlug === 'chase-foster-ii'),
      'desk live inbox surfaces Chase Foster II'
    );
  } finally {
    fs.writeFileSync(cachePath, original);
  }

  console.log('beat-offer-alderman-foster.test.js PASS');
}

main().catch((err) => {
  console.error('FAIL', err);
  process.exit(1);
});
