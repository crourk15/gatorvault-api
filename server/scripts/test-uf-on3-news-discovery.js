/**
 * Unit tests — UF On3 team news discovery (no network for fixtures).
 */
const { parseArticleIdentity } = require('../lib/uf-on3-news-discovery');
const { parseOn3BeatUrlIdentity } = require('../lib/on3-recruit-discovery');

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL:', label);
    process.exitCode = 1;
    return;
  }
  console.log('OK:', label);
}

const zyonArticle = {
  key: 4624094,
  slug: 'florida-gators-are-a-major-contender-for-4-star-wr-zyon-robinson',
  fullUrl: '/teams/florida-gators/news/florida-gators-are-a-major-contender-for-4-star-wr-zyon-robinson',
  title: 'Daily communication has Florida trending with 4-star WR',
  excerpt: 'The Florida Gators nonstop communication has one of the countrys top receivers paying close attention.',
  body: 'Powder Springs (Ga.) McEachern 4-star wide receiver Zyon Robinson is still early in his recruiting process',
  author: { name: 'Corey Bender', niceName: 'coreybender' },
  postDateGMT: '2026-06-27T14:18:59.000Z',
};

const zyonIdentity = parseArticleIdentity(zyonArticle);
assert('parses Zyon from On3 article slug', zyonIdentity && zyonIdentity.playerSlug === 'zyon-robinson');
assert('parses Zyon name from article', zyonIdentity && zyonIdentity.playerName === 'Zyon Robinson');
assert('parses WR and 4-star from article slug', zyonIdentity && zyonIdentity.pos === 'WR' && zyonIdentity.stars === 4);
assert('builds On3 article URL', zyonIdentity && /zyon-robinson/.test(zyonIdentity.on3ArticleUrl || ''));

const cyionArticle = {
  key: 4624000,
  slug: 'floridas-daily-push-is-paying-off-4-star-safety-cyion-smith',
  fullUrl: '/teams/florida-gators/news/floridas-daily-push-is-paying-off-4-star-safety-cyion-smith',
  title: "Florida's daily push is paying off 4-star safety Cyion Smith",
  excerpt: 'Cyion Smith has Florida on his radar.',
  body: '',
};
const cyionIdentity = parseArticleIdentity(cyionArticle);
assert('parses Cyion Smith from safety article slug', cyionIdentity && cyionIdentity.playerSlug === 'cyion-smith');

const tweetUrl =
  'https://on3.com/teams/florida-gators/news/florida-gators-are-a-major-contender-for-4-star-wr-zyon-robinson/';
assert('tweet URL parser still works', parseOn3BeatUrlIdentity(`DETAILS: ${tweetUrl}`, null)?.playerSlug === 'zyon-robinson');

const teaserRpmUrl =
  'https://on3.com/teams/florida-gators/news/predicting-the-florida-gators-to-land-a-4-star-defender-new-rpm/';
assert(
  'teaser RPM URL does not invent a fake player slug',
  parseOn3BeatUrlIdentity(
    `NEW: The Gators have built early momentum for a 4-star defender INTEL: ${teaserRpmUrl}`,
    null
  ) == null
);

if (process.exitCode) console.error('\nUF On3 news discovery tests failed.');
else console.log('\nAll UF On3 news discovery tests passed.');