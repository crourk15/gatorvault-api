#!/usr/bin/env node
/**
 * Purge false inferred decommit events from events, feed, autoposter queue, and rebuild caches.
 * Run: node scripts/purge-false-decommits.js
 */
const { runPurgeFalseDecommits } = require('../lib/purge-false-decommits');

async function main() {
  const result = await runPurgeFalseDecommits();
  console.log(JSON.stringify(result, null, 2));
  if (!result.clean) {
    console.error('Purge incomplete — false decommits may remain.');
    process.exit(1);
  }
  console.log('Done. Feed, alerts source data, and ticker feed are clean.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
