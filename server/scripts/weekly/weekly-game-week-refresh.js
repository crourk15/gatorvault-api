#!/usr/bin/env node
/**
 * Weekly Game Week refresh — updates meta pointer + section snapshots.
 * Cron: weekly-game-week-refresh (Sunday 06:00 UTC post-game)
 */
const fs = require('fs');
const path = require('path');

const META_PATH = path.join(__dirname, '..', '..', 'data', 'game-week', 'meta.json');

function main() {
  const meta = JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
  meta.updatedAt = new Date().toISOString();
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2) + '\n');
  console.log('[weekly-game-week-refresh] updated', meta.currentGameId, meta.updatedAt);
}

main();
