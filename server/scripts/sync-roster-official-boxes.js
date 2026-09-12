#!/usr/bin/env node
/**
 * Collect official UF box lines onto roster Stats tabs.
 * API/data only — no Codemagic after the 1.0.25 Stats-tab bake.
 *
 *   node server/scripts/sync-roster-official-boxes.js
 *   node server/scripts/sync-roster-official-boxes.js --dry-run
 *   node server/scripts/sync-roster-official-boxes.js --game=fau
 */
'use strict';

const { syncRosterOfficialBoxes } = require('../lib/roster-official-box-sync');

function argValue(flag) {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : null;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const gameId = argValue('--game');
  const result = await syncRosterOfficialBoxes({
    dryRun,
    persistSchedule: !dryRun,
    gameId: gameId || undefined,
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.ok === false) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.stack || err.message);
    process.exit(1);
  });
}
