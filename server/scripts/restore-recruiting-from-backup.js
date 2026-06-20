#!/usr/bin/env node
/**
 * Restore recruiting commits + intel from git backup (pre-cleanup ref).
 * Merges backup 2026/2027 commits with current 2028–2029 hub pool.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { isBlockedRecruit } = require('../lib/recruiting-blocked-players');
const {
  markAllCommitPlayersProtected,
  markAllCommitEventsProtected,
  isProtectedRecord,
} = require('../lib/recruiting-protected-records');
const { looksLikeFloridaCommit } = require('../lib/recruiting-verified-commits');

const REPO_ROOT = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(__dirname, '..', 'data', 'recruiting');
const DEFAULT_REF = process.env.RESTORE_GIT_REF || 'ba17091';

function gitShow(ref, filePath) {
  const spec = `${ref}:${filePath}`;
  return execSync(`git -C "${REPO_ROOT}" show "${spec}"`, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
}

function repairEventsRaw(raw) {
  return raw.replace(
    /(\},\s*\n)\s*"playerId": "jaylen-jordon"/,
    '$1  {\n    "id": "evt_jaylen_jordon_commit_on3",\n    "playerId": "jaylen-jordon"'
  );
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function slugOf(record) {
  return String(record?.slug || record?.playerSlug || record?.playerId || '').toLowerCase();
}

function isFloridaCommitPlayer(player) {
  return looksLikeFloridaCommit(player);
}

function shouldRestorePlayer(player) {
  if (!player || isBlockedRecruit(player)) return false;
  const year = Number(player.classYear);
  const cat = String(player.category || '').toLowerCase();
  const status = String(player.status || '').toLowerCase();
  const lc = String(player.lifecycle || '').toUpperCase();

  if (year === 2026 && isFloridaCommitPlayer(player)) return true;

  if (cat === 'portal' || lc === 'ROSTER') return false;
  if (status === 'enrolled' && !isFloridaCommitPlayer(player)) return false;

  if (year === 2026) return isFloridaCommitPlayer(player);
  if (year === 2027) return true;
  return false;
}

function mergePlayers(backupPlayers, currentPlayers) {
  const bySlug = new Map();

  for (const player of backupPlayers) {
    if (!shouldRestorePlayer(player)) continue;
    bySlug.set(slugOf(player), { ...player, protected: true });
  }

  for (const player of currentPlayers) {
    const slug = slugOf(player);
    if (!slug || isBlockedRecruit(player)) continue;
    if (bySlug.has(slug)) continue;
    const year = Number(player.classYear);
    if (year >= 2028 && year <= 2029) {
      bySlug.set(slug, player);
    }
  }

  return markAllCommitPlayersProtected([...bySlug.values()]).sort((a, b) => {
    const ya = Number(a.classYear) || 0;
    const yb = Number(b.classYear) || 0;
    if (ya !== yb) return ya - yb;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
}

function mergeEvents(backupEvents, currentEvents, keptSlugs) {
  const byId = new Map();
  for (const evt of backupEvents) {
    const slug = slugOf(evt);
    const year = Number(evt.classYear ?? evt.payload?.player?.classYear);
    if (year && year < 2026) continue;
    if (year && year > 2029) continue;
    if (isBlockedRecruit({ slug, name: evt.title })) continue;
    if (slug && !keptSlugs.has(slug) && year !== 2026 && year !== 2027) continue;
    const marked = markAllCommitEventsProtected([evt])[0];
    if (slug && keptSlugs.has(slug)) marked.protected = true;
    byId.set(evt.id || `${slug}|${evt.eventType}|${evt.title}`, marked);
  }
  for (const evt of currentEvents) {
    const slug = slugOf(evt);
    if (slug && !keptSlugs.has(slug) && !isProtectedRecord(evt)) continue;
    byId.set(evt.id || `${slug}|${evt.eventType}|${evt.title}`, evt);
  }
  return [...byId.values()].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
}

function mergeIntel(backupIntel, currentIntel, keptSlugs) {
  const byId = new Map();
  for (const row of backupIntel.items || []) {
    const slug = slugOf(row);
    const year = Number(row.classYear);
    if (year && year < 2026) continue;
    if (year && year > 2029) continue;
    if (isBlockedRecruit({ slug, name: row.playerName })) continue;
    byId.set(row.id || slug || row.fingerprint, row);
  }
  for (const row of currentIntel.items || []) {
    const slug = slugOf(row);
    if (slug && !keptSlugs.has(slug) && !row.protected) continue;
    byId.set(row.id || slug, row);
  }
  return {
    version: currentIntel.version || backupIntel.version || 1,
    updatedAt: new Date().toISOString(),
    items: [...byId.values()],
  };
}

function main() {
  const ref = process.argv[2] || DEFAULT_REF;
  console.log('[restore-recruiting] using git ref', ref);

  const backupPlayers = JSON.parse(gitShow(ref, 'server/data/recruiting/players.json'));
  const backupEvents = JSON.parse(repairEventsRaw(gitShow(ref, 'server/data/recruiting/events.json')));
  const backupIntel = JSON.parse(gitShow(ref, 'server/data/recruiting/intel.json'));

  const currentPlayers = readJson(path.join(DATA_DIR, 'players.json'), []);
  const currentEvents = readJson(path.join(DATA_DIR, 'events.json'), []);
  const currentIntel = readJson(path.join(DATA_DIR, 'intel.json'), { version: 1, items: [] });

  const mergedPlayers = mergePlayers(backupPlayers, currentPlayers);
  const keptSlugs = new Set(mergedPlayers.map((p) => slugOf(p)).filter(Boolean));
  const mergedEvents = mergeEvents(backupEvents, currentEvents, keptSlugs);
  const mergedIntel = mergeIntel(backupIntel, currentIntel, keptSlugs);

  const c2026 = mergedPlayers.filter((p) => Number(p.classYear) === 2026 && isFloridaCommitPlayer(p));
  const c2027 = mergedPlayers.filter((p) => Number(p.classYear) === 2027 && isFloridaCommitPlayer(p));

  writeJson(path.join(DATA_DIR, 'players.json'), mergedPlayers);
  writeJson(path.join(DATA_DIR, 'events.json'), mergedEvents);
  writeJson(path.join(DATA_DIR, 'intel.json'), mergedIntel);

  console.log('[restore-recruiting] players', currentPlayers.length, '->', mergedPlayers.length);
  console.log('[restore-recruiting] 2026 UF commits:', c2026.length, c2026.map((p) => p.slug).join(', '));
  console.log('[restore-recruiting] 2027 UF commits:', c2027.length, c2027.map((p) => p.slug).join(', '));
  console.log('[restore-recruiting] events', currentEvents.length, '->', mergedEvents.length);
  console.log('[restore-recruiting] intel items', (currentIntel.items || []).length, '->', mergedIntel.items.length);
}

main();
