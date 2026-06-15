#!/usr/bin/env node
/**
 * Remove invalid / decommitted players from recruiting store + related files.
 * Run: node server/scripts/purge-invalid-recruits.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');

const SERVER = path.join(__dirname, '..');
const { BLOCKED_PLAYER_SLUGS } = require('../lib/recruiting-blocked-players');
const REMOVE_SLUGS = BLOCKED_PLAYER_SLUGS;

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
  const doc = readJson(rel, {});
  const map = doc.entries && typeof doc.entries === 'object' ? doc.entries : doc;
  let removed = 0;
  for (const slug of REMOVE_SLUGS) {
    if (map[slug]) {
      delete map[slug];
      removed++;
    }
  }
  if (removed) writeJson(rel, doc.entries ? { ...doc, entries: map } : map);
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

function purgeTargetBoard() {
  const rel = 'data/recruiting/2027-target-board.json';
  const { ALLOWLIST_2027 } = require('../lib/recruiting-target-allowlist');
  const { filterBlockedRecruits } = require('../lib/recruiting-blocked-players');
  const doc = readJson(rel, null);
  if (!doc?.targets || !Array.isArray(doc.targets)) return 0;
  const before = doc.targets.length;
  const allowed = new Set(ALLOWLIST_2027);
  doc.targets = filterBlockedRecruits(
    doc.targets.filter((t) => allowed.has(String(t.slug || '').toLowerCase()))
  );
  const removed = before - doc.targets.length;
  if (removed) writeJson(rel, doc);
  return removed;
}

function purgeGm2Decisions() {
  const rel = 'data/recruiting/gm2-decisions.json';
  const doc = readJson(rel, null);
  const key = Array.isArray(doc?.events) ? 'events' : Array.isArray(doc?.decisions) ? 'decisions' : null;
  if (!key) return 0;
  const before = doc[key].length;
  doc[key] = doc[key].filter((d) => !REMOVE_SLUGS.has(String(d.playerSlug || '').toLowerCase()));
  const removed = before - doc[key].length;
  if (removed) writeJson(rel, doc);
  return removed;
}

function purgeJsonPlayerArray(rel) {
  const players = readJson(rel, null);
  if (!Array.isArray(players)) return 0;
  const next = players.filter((p) => !REMOVE_SLUGS.has(String(p.slug || p.id || '').toLowerCase()));
  const removed = players.length - next.length;
  if (removed) writeJson(rel, next);
  return removed;
}

function rebuildFuturecastCaches() {
  const master = readJson('data/players.json', []);
  if (!Array.isArray(master)) return { master: 0, class2027: 0 };
  const class2027 = master.filter((p) => Number(p.class_year) === 2027);
  fs.mkdirSync(path.join(SERVER, 'data', 'futurecast'), { recursive: true });
  writeJson('data/futurecast/futurecast-2027.json', class2027);
  return { master: master.length, class2027: class2027.length };
}

async function purgeFuturecastDb() {
  if (!process.env.DATABASE_URL && !process.env.SUPABASE_DATABASE_URL) {
    return { skipped: true, reason: 'no DATABASE_URL' };
  }
  try {
    const { db, closeDb } = await import('../models/db.ts');
    const slugs = [...REMOVE_SLUGS];
    const pred = await db.query(
      `DELETE FROM futurecast.predictions p
       USING futurecast.players pl
       WHERE p.player_id = pl.id AND pl.slug = ANY($1::text[])`,
      [slugs]
    );
    const players = await db.query(
      `DELETE FROM futurecast.players WHERE slug = ANY($1::text[]) RETURNING slug`,
      [slugs]
    );
    await closeDb();
    return {
      predictions: pred.rowCount || 0,
      players: players.rowCount || 0,
      slugs: players.rows?.map((r) => r.slug) || [],
    };
  } catch (err) {
    return { error: err.message || String(err) };
  }
}

async function main() {
  const n1 = purgePlayersFile('data/recruiting/players.json');
  const n2 = purgePlayersFile('data/players.json');
  const n3 = purgeIdentityPatterns();
  const n4 = purgeOn3Snapshot();
  const n5 = purgeTargetBoard();
  const n6 = purgeGm2Decisions();
  const n7 = purgeJsonPlayerArray('data/futurecast/futurecast-2027.json');
  const cache = rebuildFuturecastCaches();
  const db = await purgeFuturecastDb();
  console.log('[purge-invalid-recruits] removed', {
    recruitingPlayers: n1,
    futurecastMaster: n2,
    identityPatterns: n3,
    on3Snapshot: n4,
    targetBoard2027: n5,
    gm2Decisions: n6,
    futurecast2027: n7,
    futurecastCache: cache,
    futurecastDb: db,
    slugs: [...REMOVE_SLUGS],
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
