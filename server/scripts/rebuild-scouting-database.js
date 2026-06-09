#!/usr/bin/env node
/**
 * Batch rebuild — verified analyst scouting database for all player types.
 * Usage: node scripts/rebuild-scouting-database.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const scoutingDb = require('../lib/scouting-database');

async function main() {
  console.error('[scouting] Rebuilding verified scouting database…');
  const result = await scoutingDb.rebuildScoutingDatabase({
    delayMs: parseInt(process.env.SCOUTING_REBUILD_DELAY_MS || '400', 10),
    onProgress: ({ index, total, slug }) => {
      process.stderr.write(`[${index}/${total}] ${slug}\n`);
    }
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
