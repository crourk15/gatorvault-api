/**
 * Beat Brief Desk — deep research + live inbox wiring.
 * Run: node server/test/beat-brief-desk.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { postsFromLiveBeat, loadBeatMentions } = require('../lib/x-autoposter-elite-research');
const {
  buildBeatBrief,
  buildWhyFlorida,
  buildVaultAngle,
  mergeBeatRows
} = require('../lib/beat-brief-packet');
const { liveBeatInboxRows, getIntelInbox } = require('../lib/post-studio-intel-inbox');

const CACHE = path.join(__dirname, '..', 'data', 'live', 'beat-cache.json');
const original = fs.readFileSync(CACHE, 'utf8');

function seedCache() {
  const now = new Date();
  const ago = (h) => new Date(now.getTime() - h * 3600000).toISOString();
  const data = {
    posts: [
      {
        id: 'unit-fleming',
        handle: 'nickdegiulio',
        writerName: 'Nick Degiulio',
        outlet: 'On3',
        text:
          'Florida stays locked in on 2028 OL Joey Fleming after his spring tour. Gators staff sees upside.',
        url: 'https://example.com/fleming',
        publishedAt: ago(2),
        fetchedAt: now.toISOString()
      }
    ],
    fetchedAt: now.toISOString(),
    source: 'unit-test',
    error: null
  };
  fs.writeFileSync(CACHE, JSON.stringify(data, null, 2));
}

async function main() {
  seedCache();
  try {
    const posts = postsFromLiveBeat(40);
    assert.ok(Array.isArray(posts), 'postsFromLiveBeat returns array');
    assert.ok(posts.length >= 1, 'seeded posts visible');

    const mentions = loadBeatMentions('Joey Fleming', 5);
    assert.ok(mentions.length >= 1, 'loadBeatMentions finds Fleming (was broken when treating {posts} as array)');

    const live = liveBeatInboxRows({ maxAgeMs: 48 * 3600000 });
    assert.ok(live.rows.some((r) => r.playerSlug === 'joey-fleming'), 'live inbox matches Fleming');

    const desk = await getIntelInbox({ limit: 20, deskMode: true });
    assert.strictEqual(desk.deskMode, true);
    assert.ok(desk.liveBeatMatched >= 1, 'desk mode reports live matches');
    assert.ok(desk.items.some((i) => i.slug === 'joey-fleming' && i.liveBeat), 'desk item is live');

    const merged = mergeBeatRows(
      [{ detail: 'old', reportedAt: '2020-01-01T00:00:00Z', source: 'intel' }],
      [{ detail: 'new live', reportedAt: new Date().toISOString(), source: 'beat-writer:x', liveBeat: true }]
    );
    assert.ok(merged[0].liveBeat || merged[0].detail === 'new live', 'merge prefers fresher first');

    const why = buildWhyFlorida({
      player: { ufStatus: 'uncommitted' },
      research: { ufPosition: 'tracking', eventType: 'official_visit' },
      intelligence: null,
      beatRows: [],
      rivals: ['Georgia', 'Alabama']
    });
    assert.ok(/UF board read/i.test(why), 'whyFlorida includes board read');

    const angle = buildVaultAngle({
      playerName: 'Joey Fleming',
      research: { eventType: 'official_visit', ufPosition: 'hosting OV' },
      intelligence: { gaps: ['missing_rpm'] },
      beatRows: [{ detail: 'Fleming set for Florida OV' }],
      rivals: ['Georgia'],
      whyFlorida: why
    });
    assert.ok(/Angle:/i.test(angle), 'vaultAngle has Angle line');

    const brief = await buildBeatBrief('joey-fleming');
    assert.ok(brief.ok, 'brief ok');
    assert.ok(brief.research?.whyFlorida, 'research.whyFlorida');
    assert.ok(brief.research?.vaultAngle, 'research.vaultAngle');
    assert.ok(brief.pasteText.includes('WHY FLORIDA'), 'paste includes WHY FLORIDA');
    assert.ok(brief.pasteText.includes('VAULT ANGLE'), 'paste includes VAULT ANGLE');
    assert.ok(brief.liveBeatCount >= 1, 'brief includes live beats');

    console.log('beat-brief-desk.test.js PASS');
  } finally {
    fs.writeFileSync(CACHE, original);
  }
}

main().catch((err) => {
  try {
    fs.writeFileSync(CACHE, original);
  } catch {
    /* ignore */
  }
  console.error('FAIL', err);
  process.exit(1);
});
