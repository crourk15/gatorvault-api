#!/usr/bin/env node
/**
 * Pre-build gate — fail if any 2027/2028 target is not on Charles' allow-list.
 * Run: node server/scripts/validate-target-allowlist.js
 */
const fs = require('fs');
const path = require('path');
const {
  ALLOWLIST_2027,
  ALLOWLIST_2028,
  validateStoreTargets,
} = require('../lib/recruiting-target-allowlist');

const PLAYERS_PATH = path.join(__dirname, '..', 'data', 'recruiting', 'players.json');

function main() {
  const players = JSON.parse(fs.readFileSync(PLAYERS_PATH, 'utf8'));
  const errors = validateStoreTargets(players);

  if (errors.length) {
    console.error('[validate-target-allowlist] FAIL — unknown targets in players.json:');
    for (const e of errors) {
      console.error(`  ${e.classYear} ${e.slug} (${e.name}) — ${e.reason}`);
    }
    console.error(
      `[validate-target-allowlist] Allowed 2027 (${ALLOWLIST_2027.length}): ${ALLOWLIST_2027.join(', ')}`
    );
    console.error(
      `[validate-target-allowlist] Allowed 2028 (${ALLOWLIST_2028.length}): ${ALLOWLIST_2028.join(', ')}`
    );
    process.exit(1);
  }

  const t27 = players.filter((p) => p.classYear === 2027 && p.category === 'target');
  const t28 = players.filter((p) => p.classYear === 2028 && p.category === 'target');
  console.log(
    `[validate-target-allowlist] OK — 2027 targets: ${t27.length}, 2028 targets: ${t28.length}`
  );
}

main();
