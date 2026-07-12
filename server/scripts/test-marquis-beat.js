require('../lib/autoposter/uf-premium-mode').applyToProcessEnv();

const BEAT = `NEW: Florida surprised Marquis Evans more than any other official visit — but Auburn hold the edge on the RPM with his announcement coming at 11:35 a.m. ET today
Here's everything you need to know ahead of the announcement
Intel: https://on3.com/teams/florida-gators/news/previewing-decision-day-for-edge-target-marquis-evans/`;

const post = {
  id: 'test_marquis_evans_decision',
  handle: 'Blake_Alderman',
  writerName: 'Blake Alderman',
  text: BEAT,
  url: 'https://x.com/Blake_Alderman/status/demo_marquis',
  publishedAt: new Date().toISOString()
};

(async () => {
  const filters = require('../lib/beat-writer-filters');
  console.log('trusted', filters.isTrustedBeatWriter(post));
  console.log('include', filters.shouldIncludeBeatPost(post));
  const prefilter = require('../lib/beat-intel-prefilter');
  const guarded = await prefilter.guardBeatPost(post);
  console.log('guard', guarded.eligible, guarded.reason || guarded.skipReason || guarded.logTag);
  const fill = require('../lib/x-autoposter-fill');
  const news = await fill.buildNewsFromBeatPost(post);
  if (!news) {
    console.log('buildNewsFromBeatPost: null');
    return;
  }
  if (news.skipReason || news._identitySkip) {
    console.log('skip', news.skipReason, news._identitySkip, news.missingFields);
    return;
  }
  console.log('player', news.playerName, news.playerSlug);
  console.log('text preview', String(news.text || '').slice(0, 280));
  const finalized = await fill.finalizeNewsCandidate(news);
  console.log('finalized', !!finalized, finalized?.qualityScore);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
