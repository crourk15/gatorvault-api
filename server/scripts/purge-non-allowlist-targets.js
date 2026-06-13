#!/usr/bin/env node
/**
 * Remove 2027/2028 target records not on Charles' allow-list from players.json.
 * Run once: node server/scripts/purge-non-allowlist-targets.js
 */
const fs = require('fs');
const path = require('path');
const { validateStoreTargets, isAllowlistedTarget } = require('../lib/recruiting-target-allowlist');

const PLAYERS_PATH = path.join(__dirname, '..', 'data', 'recruiting', 'players.json');

function main() {
  const players = JSON.parse(fs.readFileSync(PLAYERS_PATH, 'utf8'));
  let removed = 0;
  let reclassified = 0;

  const next = players.filter((p) => {
    const year = parseInt(p.classYear, 10);
    if (p.category !== 'target' || (year !== 2027 && year !== 2028)) return true;
    if (isAllowlistedTarget(p)) return true;
    removed += 1;
    console.log(`  remove target: ${year} ${p.slug} (${p.name})`);
    return false;
  });

  fs.writeFileSync(PLAYERS_PATH, JSON.stringify(next, null, 2));

  const remaining = validateStoreTargets(next);
  if (remaining.length) {
    console.error('Still invalid after purge:', remaining);
    process.exit(1);
  }

  console.log(`purge-non-allowlist-targets: removed ${removed}, reclassified ${reclassified}`);
  console.log(
    `2027 targets now: ${next.filter((p) => p.classYear === 2027 && p.category === 'target').length}`
  );
  console.log(
    `2028 targets now: ${next.filter((p) => p.classYear === 2028 && p.category === 'target').length}`
  );
}

main();
