#!/usr/bin/env node
/**
 * Remove invalid / decommitted players from recruiting store + related files.
 * Run: node server/scripts/purge-invalid-recruits.js
 */
const fs = require('fs');
const path = require('path');

const SERVER = path.join(__dirname, '..');
const REMOVE_SLUGS = new Set([
  'jaylen-jordan',
  'kennedee-jackson',
  'tj-shanahan-jr',
  't-j-shanahan',
]);

function readJson(rel, fallback) {
  const p = path.join(SERVER, rel);
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(rel, data) {
  fs.writeFileSync(path.join(SERVER, rel), `${JSON.stringify(data, null, 2)}\n`);
}

function purgePlayersFile(rel) {
  const players = readJson(rel, []);
  if (!Array.isArray(players)) return 0;
  const next = players.filter((p) => !REMOVE_SLUGS.has(p.slug) && !REMOVE_SLUGS.has(p.id));
  const removed = players.length - next.length;
  if (removed) writeJson(rel, next);
  return removed;
}

function purgeIdentityPatterns() {
  const rel = 'data/recruiting/identity-patterns.json';
  const map = readJson(rel, {});
  let removed = 0;
  for (const slug of REMOVE_SLUGS) {
    if (map[slug]) {
      delete map[slug];
      removed++;
    }
  }
  if (removed) writeJson(rel, map);
  return removed;
}

function purgeOn3Snapshot() {
  const rel = 'data/recruiting/on3-snapshot.json';
  const snap = readJson(rel, null);
  if (!snap) return 0;
  let removed = 0;
  for (const year of ['2026', '2027', '2028']) {
    const commits = snap?.commits?.[year];
    if (!commits || typeof commits !== 'object') continue;
    for (const key of Object.keys(commits)) {
      const entry = commits[key];
      const slug = String(entry?.slug ?? entry?.on3Slug ?? key).toLowerCase();
      if ([...REMOVE_SLUGS].some((s) => slug.includes(s.replace(/-/g, '')) || slug.includes(s))) {
        delete commits[key];
        removed++;
      }
    }
  }
  if (removed) writeJson(rel, snap);
  return removed;
}

function main() {
  const n1 = purgePlayersFile('data/recruiting/players.json');
  const n2 = purgePlayersFile('data/players.json');
  const n3 = purgeIdentityPatterns();
  const n4 = purgeOn3Snapshot();
  console.log('[purge-invalid-recruits] removed', {
    recruitingPlayers: n1,
    legacyPlayers: n2,
    identityPatterns: n3,
    on3Snapshot: n4,
    slugs: [...REMOVE_SLUGS],
  });
}

main();
