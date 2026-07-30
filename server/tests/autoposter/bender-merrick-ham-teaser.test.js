const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const teaser = require('../../lib/beat-teaser-resolve');
const discovery = require('../../lib/on3-recruit-discovery');
const { liveBeatInboxRows } = require('../../lib/post-studio-intel-inbox');

const ARTICLE =
  'https://www.on3.com/teams/florida-gators/news/gators-trending-as-top-contender-for-merrick-ham-ahead-of-fall-visit/';

const BENDER_TEASER = {
  id: 'bender-merrick-father-teaser',
  handle: 'Corey_Bender',
  writerName: 'Corey Bender',
  outlet: 'On3 / Gators Online',
  text:
    "The father of one of the nation's top EDGE prospects grew up a big Florida fan\n\n" +
    'Now, the Gators are set to receive another visit as momentum continues to build.\n\n' +
    'DETAILS: https://t.co/EZZjYODk3D (On3+) https://t.co/JVjqMCHcye',
  url: 'https://t.co/EZZjYODk3D',
  publishedAt: new Date().toISOString()
};

async function mockFetch(u) {
  if (String(u).includes('t.co')) {
    return { url: ARTICLE, ok: true };
  }
  return { url: String(u), ok: true };
}

describe('Bender Merrick Ham nameless On3+ teaser', () => {
  it('parses merrick-ham from the expanded On3 news slug', () => {
    const hit = discovery.parseOn3BeatUrlIdentity('teaser', ARTICLE);
    assert.equal(hit && hit.playerSlug, 'merrick-ham');
    assert.match(hit.playerName, /Merrick Ham/i);
  });

  it('resolves the t.co teaser to Merrick Ham after short-link expand', async () => {
    const resolved = await teaser.resolvePlayerFromBeatPost(BENDER_TEASER, {
      fetchImpl: mockFetch
    });
    assert.equal(resolved && resolved.playerSlug, 'merrick-ham');
    assert.equal(resolved.on3ArticleUrl, ARTICLE);
  });

  it('surfaces Merrick Ham on Beat Desk live inbox when On3 URL is known', async () => {
    const cachePath = path.join(__dirname, '../../data/live/beat-cache.json');
    const original = fs.readFileSync(cachePath, 'utf8');
    const post = {
      ...BENDER_TEASER,
      // After expandShortUrl, attachmentUrls includes the real On3 article.
      attachmentUrls: [ARTICLE]
    };
    try {
      fs.writeFileSync(
        cachePath,
        JSON.stringify({
          posts: [post],
          fetchedAt: new Date().toISOString(),
          source: 'unit-test'
        })
      );
      const live = await liveBeatInboxRows({ maxAgeMs: 48 * 3600000 });
      assert.ok(
        live.rows.some((r) => r.playerSlug === 'merrick-ham'),
        'desk should show merrick-ham from Bender teaser'
      );
    } finally {
      fs.writeFileSync(cachePath, original);
    }
  });
});
