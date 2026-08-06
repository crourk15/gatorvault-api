const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildShareModel,
  buildShareSvg,
  handleSharePlayerRequest,
  loadLocalSharePayload,
  isShareCrawler,
  parseSharePath,
} = require('../../lib/share-player-card');

test('parseSharePath reads slug + og.jpg', () => {
  assert.deepEqual(parseSharePath('/share/player/maxwell-hiller'), {
    slug: 'maxwell-hiller',
    wantImage: false,
  });
  assert.deepEqual(parseSharePath('/share/player/maxwell-hiller/og.jpg'), {
    slug: 'maxwell-hiller',
    wantImage: true,
  });
});

test('isShareCrawler detects Twitterbot', () => {
  assert.equal(isShareCrawler('Twitterbot/1.0'), true);
  assert.equal(isShareCrawler('Mozilla/5.0'), false);
});

test('loadLocalSharePayload finds Maxwell Hiller without API', () => {
  const payload = loadLocalSharePayload('maxwell-hiller');
  assert.ok(payload);
  assert.equal(payload.player.slug, 'maxwell-hiller');
  assert.equal(payload.player.name, 'Maxwell Hiller');
  assert.equal(payload.player.position, 'IOL');
  assert.equal(payload.player.committedTo, 'Florida');
  const model = buildShareModel(payload);
  assert.match(model.title, /Maxwell Hiller/);
  assert.match(model.title, /Florida Commit/);
  assert.equal(model.composite, '98.5');
  assert.equal(model.natl, '#3 NATL');
});

test('handleSharePlayerRequest serves OG HTML from local fallback', async () => {
  const result = await handleSharePlayerRequest({
    pathname: '/share/player/maxwell-hiller',
    host: 'deploy-preview-337--stupendous-paprenjak-bedb92.netlify.app',
    userAgent: 'Twitterbot/1.0',
  });
  assert.equal(result.statusCode, 200);
  assert.match(result.headers['Content-Type'], /text\/html/);
  assert.match(result.body, /og:title/);
  assert.match(result.body, /Maxwell Hiller/);
  assert.match(result.body, /twitter:card/);
  assert.match(result.body, /summary_large_image/);
  assert.match(result.body, /\/share\/player\/maxwell-hiller\/og\.jpg/);
  // Crawlers must not be bounced away before OG parse.
  assert.doesNotMatch(result.body, /http-equiv="refresh"/i);
});

test('handleSharePlayerRequest humans get vault redirect', async () => {
  const result = await handleSharePlayerRequest({
    pathname: '/share/player/maxwell-hiller',
    host: 'example.com',
    userAgent: 'Mozilla/5.0',
  });
  assert.equal(result.statusCode, 200);
  assert.match(result.body, /http-equiv="refresh"/i);
  assert.match(result.body, /\/vault\/futurecast\/player\/maxwell-hiller/);
});

test('buildShareSvg draws path text (Netlify-safe, no system fonts)', () => {
  const model = buildShareModel(loadLocalSharePayload('davin-davidson'));
  const svg = buildShareSvg(model);
  assert.match(svg, /<path fill="#ffffff"/);
  assert.doesNotMatch(svg, /<text /);
  assert.match(svg, /Davin|M\d/); // path data present
});
