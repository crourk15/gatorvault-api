#!/usr/bin/env node
/**
 * Audit Hottest Florida Targets composite rank.
 *
 *   node server/scripts/audit-hot-targets.js
 *   node server/scripts/audit-hot-targets.js --year=2028 --top=20
 */
'use strict';

const { scoreHotTargetBoard } = require('../lib/hot-florida-targets');
const { getAllowlistSet } = require('../lib/recruiting-target-allowlist');
const { getLiveBoardTargets } = require('../lib/live-board-targets');

function argValue(flag, fallback = null) {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : fallback;
}

async function main() {
  const year = Number(argValue('--year', '2028')) || 2028;
  const topN = Number(argValue('--top', '20')) || 20;
  const allow = getAllowlistSet(year);
  const live = await getLiveBoardTargets(year);
  const scored = scoreHotTargetBoard(live, { classYear: year }).sort(
    (a, b) => (b.hotScore || 0) - (a.hotScore || 0) || String(a.name).localeCompare(String(b.name))
  );

  console.log(`\n=== ${year} Hottest Targets audit ===`);
  console.log(JSON.stringify({ liveBoard: live.length, allowlist: allow.size }, null, 2));
  console.log(`\nTop ${topN} by hotScore:`);
  for (let i = 0; i < Math.min(topN, scored.length); i += 1) {
    const r = scored[i];
    const lanes = r.hotLanes || {};
    const badges = Object.entries(r.hotBadges || {})
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(',');
    console.log(
      `${String(i + 1).padStart(2)}. ${String(r.name || r.slug).padEnd(22)} ${String(r.pos || '—').padEnd(4)} hot=${String(r.hotScore).padStart(5)} chase=${String(r.chaseScore).padStart(5)}  fit${lanes.mustGetFit}/need${lanes.positionalNeed}/staff${lanes.staffHeat}/geo${lanes.geoPipeline}${badges ? `  [${badges}]` : ''}`
    );
  }
  console.log('Done.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
