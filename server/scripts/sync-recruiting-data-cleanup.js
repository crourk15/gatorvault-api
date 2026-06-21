#!/usr/bin/env node
/**
 * One-time data cleanup: Andre Hyppolite (Miami commit) + verify allow-list filters.
 */
const store = require('../lib/recruiting-store');

async function main() {
  await store.upsertPlayer({
    slug: 'andre-hyppolite',
    name: 'Andre Hyppolite',
    pos: 'LB',
    classYear: 2027,
    school: 'American Heritage, FL',
    state: 'FL',
    stars: 4,
    rating: 91,
    natlRank: 285,
    category: 'target',
    status: 'committed',
    committedTo: 'Miami',
    on3Source: 'manual-cleanup',
    updatedAt: new Date().toISOString(),
  });

  const ghioto = await store.getPlayerBySlug('asher-ghioto');
  if (ghioto) {
    await store.upsertPlayer({
      ...ghioto,
      pos: 'EDGE',
      classYear: 2028,
      updatedAt: new Date().toISOString(),
    });
  }

  const board = await store.getBoard(2027);
  const hyppoliteOnBoard = (board.targets || []).some((p) => p.slug === 'andre-hyppolite');
  console.log(
    JSON.stringify(
      {
        ok: true,
        hyppoliteOnBoard,
        ghiotoPos: (await store.getPlayerBySlug('asher-ghioto'))?.pos,
        targetCount2027: board.targets.length,
      },
      null,
      2
    )
  );

  if (hyppoliteOnBoard) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
