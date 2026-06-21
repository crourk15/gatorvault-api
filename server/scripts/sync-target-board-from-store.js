#!/usr/bin/env node
/**
 * Copy pos/school/ratings from recruiting store into YYYY-target-board.json seeds.
 */
const fs = require('fs');
const path = require('path');

const PLAYERS_PATH = path.join(__dirname, '..', 'data', 'recruiting', 'players.json');

function syncYear(classYear) {
  const boardPath = path.join(__dirname, '..', 'data', 'recruiting', `${classYear}-target-board.json`);
  const players = JSON.parse(fs.readFileSync(PLAYERS_PATH, 'utf8'));
  const bySlug = new Map(
    players
      .filter((p) => Number(p.classYear) === classYear)
      .map((p) => [String(p.slug).toLowerCase(), p])
  );
  let board;
  try {
    board = JSON.parse(fs.readFileSync(boardPath, 'utf8'));
  } catch {
    board = { version: 1, description: `UF ${classYear} target board seed`, targets: [] };
  }
  board.targets = board.targets || [];
  let updated = 0;
  for (const row of board.targets) {
    const store = bySlug.get(String(row.slug || '').toLowerCase());
    if (!store) continue;
    if (store.pos) row.pos = store.pos;
    if (store.school) row.school = store.school;
    if (store.state) row.state = store.state;
    if (store.stars != null) row.stars = store.stars;
    if (store.rating != null) row.rating = store.rating;
    if (store.natlRank != null) row.natlRank = store.natlRank;
    if (store.posRank != null) row.posRank = store.posRank;
    if (store.committedTo != null) row.committedTo = store.committedTo;
    updated += 1;
  }
  fs.writeFileSync(boardPath, `${JSON.stringify(board, null, 2)}\n`);
  console.log(`[sync-target-board] ${classYear}: updated ${updated} rows`);
}

for (const year of [2027, 2028]) {
  try {
    syncYear(year);
  } catch (err) {
    console.warn(`[sync-target-board] ${year} skipped:`, err.message);
  }
}
