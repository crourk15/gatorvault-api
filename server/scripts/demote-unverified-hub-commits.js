#!/usr/bin/env node
'use strict';

/**
 * Demote false UF commits for hub class years, then optionally sync allowlist slugs from players.json.
 * Usage:
 *   node server/scripts/demote-unverified-hub-commits.js
 *   SYNC_CLASS_YEAR=2027 node server/scripts/demote-unverified-hub-commits.js --sync-allowlist
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const store = require('../lib/recruiting-store');
const { demoteUnverifiedHubCommit, restoreVerifiedHubCommitsInStore } = require('../lib/recruiting-verified-commits');
const { syncSlugsFromJson } = require('../lib/sync-json-players-to-store');
const { ALLOWLIST_2027, ALLOWLIST_2028 } = require('../lib/recruiting-target-allowlist');
const { loadPlayersJson } = require('../lib/sync-json-players-to-store');
const { isCommittedElsewhere } = require('../lib/recruiting-target-filters');

function activeAllowlistSlugs(classYear) {
  const allowlist = classYear === 2027 ? ALLOWLIST_2027 : classYear === 2028 ? ALLOWLIST_2028 : [];
  const bySlug = new Map(loadPlayersJson().map((p) => [String(p.slug || '').toLowerCase(), p]));
  return allowlist.filter((slug) => {
    const p = bySlug.get(slug);
    if (!p || p.category !== 'target') return false;
    if (isCommittedElsewhere(p)) return false;
    return true;
  });
}

async function demoteInStore() {
  const all = await store.getAllPlayers();
  let demoted = 0;
  const slugs = [];
  for (const p of all) {
    const next = demoteUnverifiedHubCommit(p);
    if (next.status === p.status && next.committedTo === p.committedTo && next.category === p.category) {
      continue;
    }
    await store.upsertPlayer({ ...next, updatedAt: new Date().toISOString() });
    demoted += 1;
    slugs.push(p.slug);
  }
  const restored = await restoreVerifiedHubCommitsInStore();
  return { demoted, restored, slugs };
}

async function main() {
  const syncAllowlist = process.argv.includes('--sync-allowlist');
  const classYear = parseInt(process.env.SYNC_CLASS_YEAR || '2027', 10);

  console.log('[demote-unverified-hub-commits] storage=' + store.storageMode());
  const result = await demoteInStore();
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));

  if (syncAllowlist) {
    const slugs = activeAllowlistSlugs(classYear);
    const sync = await syncSlugsFromJson(slugs, { warmHub: true });
    console.log(JSON.stringify({ syncAllowlist: sync }, null, 2));
    if (!sync.ok) process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('[demote-unverified-hub-commits] error:', err.message);
  process.exit(1);
});
