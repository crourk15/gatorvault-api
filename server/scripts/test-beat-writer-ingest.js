/**
 * Unit tests — beat-writer-ingest visit parsing (no network).
 */
const ingest = require('../lib/beat-writer-ingest');
const cancelParser = require('../lib/beat-visit-intel-parser');
const { parseOn3BeatUrlIdentity } = require('../lib/on3-recruit-discovery');

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL:', label);
    process.exitCode = 1;
    return;
  }
  console.log('OK:', label);
}

const benderPost = {
  handle: 'Corey_Bender',
  writerName: 'Corey Bender',
  outlet: 'On3',
  text: '2027 4-star WR Jalen Brewster is set to officially visit Florida this weekend, sources tell @GatorsOnline.',
  publishedAt: '2026-06-05T14:00:00.000Z',
  url: 'https://x.com/Corey_Bender/status/1'
};

const parsed = ingest.parseBeatPostForVisitIntel(benderPost);
assert('parses official visit from Bender', parsed && parsed.eventType === 'official_visit');
assert('extracts Jalen Brewster', parsed && parsed.playerName === 'Jalen Brewster');
assert('extracts class year 2027', parsed && parsed.classYear === 2027);
assert('extracts visit date this weekend', parsed && parsed.visitStart === 'this weekend');

const hardenPost = {
  handle: 'ttjharden8',
  writerName: 'Tyler Harden',
  text: '2026 LB Marcus Jones was on campus in Gainesville today for an unofficial visit with Florida staff.',
  publishedAt: '2026-06-05T15:00:00.000Z',
  url: 'https://x.com/ttjharden8/status/2'
};
const hardenParsed = ingest.parseBeatPostForVisitIntel(hardenPost);
assert('parses on-campus visit from Harden', hardenParsed && hardenParsed.eventType === 'unofficial_visit');

const cancelPost = {
  handle: 'Hayesfawcett3',
  writerName: 'Hayes Fawcett',
  text: 'Amare Patterson has cancelled his OV to Florida and will visit South Carolina this weekend.',
  publishedAt: '2026-06-05T16:00:00.000Z'
};
assert('skips OV cancel posts', !ingest.parseBeatPostForVisitIntel(cancelPost));
assert('cancel parser still catches cancels', cancelParser.isVisitCancelPost(cancelPost.text));

const randomPost = {
  handle: 'randomuser',
  writerName: 'Random',
  text: '2027 QB Some Player set to visit Florida this weekend.',
  publishedAt: '2026-06-05T17:00:00.000Z'
};
assert('rejects untrusted writer', !ingest.parseBeatPostForVisitIntel(randomPost, { logSkips: false }));

const offerPost = {
  handle: 'Blake_Alderman',
  writerName: 'Blake Alderman',
  text: 'Florida has offered 2027 4-star EDGE Marcus Williams from IMG Academy, sources tell @GatorsOnline.',
  publishedAt: '2026-06-05T18:00:00.000Z',
  url: 'https://x.com/Blake_Alderman/status/3'
};
const offerParsed = ingest.parseBeatPostForVisitIntel(offerPost, { logSkips: false });
assert('parses offer intel from Alderman', offerParsed && offerParsed.eventType === 'offer');
assert('extracts offer player name', offerParsed && offerParsed.playerName === 'Marcus Williams');

assert('recruiting intel detector catches offers', ingest.isRecruitingIntelPost(offerPost.text, offerPost));

assert('new 2028 prospect needs provision', ingest.needsBeatProspectProvision(null, 2028));
assert('incomplete stub needs provision', ingest.needsBeatProspectProvision({ slug: 'zyon-robinson' }, 2028));
const fullAllowlisted = { slug: 'kaleb-ballard', on3Id: '123', stars: 4, natlRank: 50 };
assert('complete allowlisted player skips provision', !ingest.needsBeatProspectProvision(fullAllowlisted, 2028));

const zyonUrl =
  'https://on3.com/teams/florida-gators/news/florida-gators-are-a-major-contender-for-4-star-wr-zyon-robinson/';
const zyonFromUrl = parseOn3BeatUrlIdentity(`DETAILS: ${zyonUrl} (On3+).`, null);
assert('parses Zyon slug from On3 news URL', zyonFromUrl && zyonFromUrl.playerSlug === 'zyon-robinson');
assert('parses Zyon name from On3 news URL', zyonFromUrl && zyonFromUrl.playerName === 'Zyon Robinson');
assert('parses WR + 4-star from On3 news URL', zyonFromUrl && zyonFromUrl.pos === 'WR' && zyonFromUrl.stars === 4);

const benderZyonPost = {
  handle: 'Corey_Bender',
  writerName: 'Corey Bender',
  outlet: 'On3',
  text:
    '"I talk to them daily; every day we talk." With three coaches in hot pursuit, Florida has wasted no time making one of the top 2028 WRs feel like a major priority. Safe to say the interest is mutual... DETAILS: https://on3.com/teams/florida-gators/news/florida-gators-are-a-major-contender-for-4-star-wr-zyon-robinson/ (On3+).',
  publishedAt: '2026-06-22T18:00:00.000Z',
  url: 'https://x.com/Corey_Bender/status/zyon-test'
};
const benderZyonParsed = ingest.parseBeatPostForVisitIntel(benderZyonPost, { logSkips: false });
assert('parses vague Bender tweet via On3 URL', benderZyonParsed && benderZyonParsed.playerSlug === 'zyon-robinson');
assert('extracts Zyon Robinson from vague Bender tweet', benderZyonParsed && benderZyonParsed.playerName === 'Zyon Robinson');
assert('uses On3 article URL for intel link', benderZyonParsed && benderZyonParsed.articleUrl === zyonUrl);
assert('infers 2028 class year from Bender tweet', benderZyonParsed && benderZyonParsed.classYear === 2028);

(async () => {
  require('../lib/autoposter/uf-premium-mode').applyToProcessEnv();
  const marquisPost = {
    handle: 'Blake_Alderman',
    writerName: 'Blake Alderman',
    text:
      "NEW: Florida surprised Marquis Evans more than any other official visit — but Auburn hold the edge on the RPM with his announcement coming at 11:35 a.m. ET today. Here's everything you need to know ahead of the announcement Intel: https://on3.com/teams/florida-gators/news/previewing-decision-day-for-edge-target-marquis-evans/",
    publishedAt: new Date().toISOString(),
    url: 'https://x.com/Blake_Alderman/status/marquis-test'
  };
  const filters = require('../lib/beat-writer-filters');
  assert('Marquis tweet trusted writer', filters.isTrustedBeatWriter(marquisPost));
  assert('Marquis tweet passes UF filter', filters.shouldIncludeBeatPost(marquisPost));
  const prefilter = require('../lib/beat-intel-prefilter');
  const guarded = await prefilter.guardBeatPost(marquisPost);
  assert('Marquis tweet prefilter eligible', guarded.eligible !== false);
  const fill = require('../lib/x-autoposter-fill');
  const news = await fill.buildNewsFromBeatPost(marquisPost);
  assert('Marquis beat builds news', news && news.text && !news.skipReason);
  if (news?.text) console.log('Marquis preview:', String(news.text).slice(0, 220));

  const flemingPost = {
    handle: 'corey_bender',
    writerName: 'Corey Bender',
    text:
      '"100 percent." That was Joey Fleming\'s answer when asked if another trip to Gainesville could happen soon. The nation\'s No. 1 interior OL details his strong interest in the Gators and more... INTEL: https://on3.com/teams/florida-gators/news/florida-gators-making-headway-with-no-1-interior-ol-joey-fleming/',
    publishedAt: new Date().toISOString(),
    url: 'https://x.com/Corey_Bender/status/fleming-test'
  };
  const on3 = require('../lib/on3-recruit-discovery');
  const flemingUrl = on3.parseOn3BeatUrlIdentity(flemingPost.text, flemingPost.url);
  assert('Fleming On3 URL resolves slug', flemingUrl && flemingUrl.playerSlug === 'joey-fleming');
  assert('Fleming On3 URL resolves IOL', flemingUrl && flemingUrl.pos === 'IOL');
  assert('Fleming tweet trusted writer', filters.isTrustedBeatWriter(flemingPost));
  assert('Fleming tweet passes UF filter', filters.shouldIncludeBeatPost(flemingPost));
  const flemingGuarded = await prefilter.guardBeatPost(flemingPost);
  assert('Fleming tweet prefilter eligible', flemingGuarded.eligible !== false);
  const flemingNews = await fill.buildNewsFromBeatPost(flemingPost);
  assert('Fleming beat builds news', flemingNews && flemingNews.text && !flemingNews.skipReason);
  if (flemingNews?.text) console.log('Fleming preview:', String(flemingNews.text).slice(0, 280));
})().finally(() => {
  if (process.exitCode) {
    console.error('\nBeat writer ingest tests failed.');
    process.exit(1);
  }
  console.log('\nAll beat writer ingest tests passed.');
});
