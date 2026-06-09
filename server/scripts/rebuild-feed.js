/**
 * Rebuild feed-items.json with correct six-category classification.
 * Run: node scripts/rebuild-feed.js
 */
const liveStore = require('../lib/live-store');
const recruitingStore = require('../lib/recruiting-store');
const { feedDedupeKeyForCommit } = require('../lib/commit-fingerprint');
const { ingestRecruitingEvents, ingestRecruitingIntel, ingestPublishedContent } = require('../lib/live-aggregator');

async function ingestBoardCommits() {
  const playerIndex = liveStore.loadPlayerIndex();
  let count = 0;
  for (const year of [2027, 2028, 2029]) {
    const board = await recruitingStore.getBoard(year);
    for (const p of board.commits) {
      const classified = liveStore.classifyFeedItem(
        {
          id: feedDedupeKeyForCommit(p.slug, p) || `commit:${p.slug}`,
          dedupeKey: feedDedupeKeyForCommit(p.slug, p) || `commit:${p.slug}`,
          type: 'commit',
          title: `${p.name} commits to Florida`,
          summary: p.skinny || `${p.pos} · ${p.stars}★ · ${p.school}`,
          source_url: `/player/${p.slug}`,
          source: 'on3',
          author: 'GatorVault Recruiting',
          createdAt: p.commitDate ? new Date(p.commitDate).toISOString() : liveStore.nowIso(),
          meta: { eventType: 'commit', playerSlug: p.slug, player: p, on3: true }
        },
        playerIndex
      );
      if (!classified) continue;
      liveStore.upsertFeedItem(classified);
      count += 1;
    }
  }
  return count;
}

async function main() {
  console.log('Deduping commit feed items…');
  const d = liveStore.dedupeCommitFeedItems();
  console.log('  commits unique:', d.commits, 'removed:', d.removed);

  console.log('Purging test items…');
  liveStore.purgeTestFeedItems();

  console.log('Reclassifying existing feed…');
  const first = liveStore.reclassifyFeedItems();
  console.log('  pass 1:', first);

  console.log('Re-ingesting recruiting events…');
  const n = await ingestRecruitingEvents();
  console.log('  recruiting items:', n);

  console.log('Re-ingesting recruiting intel…');
  const intel = await ingestRecruitingIntel();
  console.log('  intel items:', intel);

  console.log('Seeding 2027+ board commits…');
  const b = await ingestBoardCommits();
  console.log('  board commits:', b);

  console.log('Re-ingesting articles…');
  const a = ingestPublishedContent();
  console.log('  articles:', a);

  const final = liveStore.reclassifyFeedItems();
  console.log('  pass 2:', final);

  const byType = liveStore.getFeedItems({ limit: 500, categoriesOnly: true }).reduce((acc, i) => {
    acc[i.type] = (acc[i.type] || 0) + 1;
    return acc;
  }, {});
  console.log('Feed by type:', byType);
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
