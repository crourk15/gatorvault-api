#!/usr/bin/env node
/**
 * Safe recruiting JSON cleanup — never removes protected commits, targets, or intel.
 */
const fs = require('fs');
const path = require('path');
const { isBlockedRecruit } = require('../lib/recruiting-blocked-players');
const {
  isProtectedRecord,
  markAllCommitPlayersProtected,
  markAllCommitEventsProtected,
} = require('../lib/recruiting-protected-records');
const { looksLikeFloridaCommit } = require('../lib/recruiting-verified-commits');

const DATA_DIR = path.join(__dirname, '..', 'data', 'recruiting');
const ACTIVE_CLASS_YEARS = new Set([2026, 2027, 2028, 2029]);

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

function repairEventsRaw(raw) {
  return raw.replace(
    /(\},\s*\n)\s*"playerId": "jaylen-jordon"/,
    '$1  {\n    "id": "evt_jaylen_jordon_commit_on3",\n    "playerId": "jaylen-jordon"'
  );
}

function loadEvents() {
  const filePath = path.join(DATA_DIR, 'events.json');
  let raw = fs.readFileSync(filePath, 'utf8');
  raw = repairEventsRaw(raw);
  return JSON.parse(raw);
}

function slugOf(record) {
  return String(record?.slug || record?.playerSlug || record?.playerId || '').toLowerCase();
}

function isPortalOrEnrolledNoise(player) {
  if (!player || isProtectedRecord(player)) return false;
  if (Number(player.classYear) === 2026 && looksLikeFloridaCommit(player)) return false;
  const cat = String(player.category || '').toLowerCase();
  const status = String(player.status || '').toLowerCase();
  const lc = String(player.lifecycle || '').toUpperCase();
  if (cat === 'portal') return true;
  if (lc === 'ROSTER') return true;
  if (status === 'enrolled' && !looksLikeFloridaCommit(player)) return true;
  return false;
}

function isPreCycleNoise(player) {
  if (!player || isProtectedRecord(player)) return false;
  const year = Number(player.classYear);
  if (!Number.isFinite(year)) return true;
  return year < 2026;
}

function shouldRemovePlayer(player) {
  if (!player) return true;
  if (isProtectedRecord(player)) return false;
  if (isBlockedRecruit(player)) return true;
  if (looksLikeFloridaCommit(player)) return false;
  if (isPortalOrEnrolledNoise(player)) return true;
  if (isPreCycleNoise(player)) return true;
  const year = Number(player.classYear);
  if (!ACTIVE_CLASS_YEARS.has(year)) return true;
  return false;
}

function dedupePlayers(players) {
  const bySlug = new Map();
  for (const player of players) {
    const slug = slugOf(player);
    if (!slug) continue;
    const prev = bySlug.get(slug);
    if (!prev) {
      bySlug.set(slug, player);
      continue;
    }
    const prevTs = new Date(prev.updatedAt || 0).getTime();
    const ts = new Date(player.updatedAt || 0).getTime();
    bySlug.set(slug, ts >= prevTs ? player : prev);
  }
  return [...bySlug.values()];
}

function shouldRemoveEvent(evt, keptSlugs) {
  if (!evt) return true;
  if (isProtectedRecord(evt)) return false;
  const slug = slugOf(evt);
  const eventType = String(evt.eventType || '').toLowerCase();
  if (eventType === 'ranking_change' || slug === 'class-2027') return false;
  if (slug && keptSlugs.has(slug)) return false;
  if (isBlockedRecruit({ slug, name: evt.title })) return true;
  const year = Number(evt.classYear ?? evt.payload?.player?.classYear);
  if (year && year < 2026) return true;
  if (year && !ACTIVE_CLASS_YEARS.has(year)) return true;
  return !slug || !keptSlugs.has(slug);
}

function dedupeEvents(events) {
  const seen = new Map();
  const out = [];
  for (const evt of events) {
    const slug = slugOf(evt);
    const key = `${slug}|${evt.eventType || ''}|${evt.title || ''}`;
    const prev = seen.get(key);
    if (prev) {
      const prevTs = new Date(prev.createdAt || 0).getTime();
      const ts = new Date(evt.createdAt || 0).getTime();
      if (ts <= prevTs) continue;
      const idx = out.indexOf(prev);
      if (idx >= 0) out.splice(idx, 1);
    }
    seen.set(key, evt);
    out.push(evt);
  }
  return out;
}

function cleanIntelItems(items, keptSlugs) {
  return (items || []).filter((row) => {
    if (isProtectedRecord(row)) return true;
    const slug = slugOf(row);
    if (isBlockedRecruit({ slug, name: row.playerName })) return false;
    const year = Number(row.classYear);
    if (year && year < 2026) return false;
    if (slug && keptSlugs.has(slug)) return true;
    if (row.source && row.detail && year >= 2027 && year <= 2029) return true;
    return false;
  });
}

function cleanLogItems(items, keptSlugs) {
  return (items || []).filter((row) => {
    const slug = slugOf(row);
    return slug && keptSlugs.has(slug) && !isBlockedRecruit({ slug, name: row.playerName });
  });
}

function main() {
  const playersPath = path.join(DATA_DIR, 'players.json');
  const eventsPath = path.join(DATA_DIR, 'events.json');
  const intelPath = path.join(DATA_DIR, 'intel.json');
  const visitLogsPath = path.join(DATA_DIR, 'visit_logs.json');
  const offerLogsPath = path.join(DATA_DIR, 'offer_logs.json');

  const players = markAllCommitPlayersProtected(readJson(playersPath, []));
  const keptPlayers = dedupePlayers(players.filter((p) => !shouldRemovePlayer(p)));
  const keptSlugs = new Set(keptPlayers.map((p) => slugOf(p)).filter(Boolean));

  let events;
  try {
    events = markAllCommitEventsProtected(loadEvents()).map((evt) => {
      const slug = slugOf(evt);
      if (slug && keptSlugs.has(slug)) return { ...evt, protected: true };
      return evt;
    });
  } catch (err) {
    console.error('[clean-recruiting] events.json parse failed:', err.message);
    process.exit(1);
  }

  const filteredEvents = dedupeEvents(events.filter((evt) => !shouldRemoveEvent(evt, keptSlugs)));

  const intelDoc = readJson(intelPath, { version: 1, items: [] });
  intelDoc.items = cleanIntelItems(intelDoc.items, keptSlugs);
  intelDoc.updatedAt = new Date().toISOString();

  const visitDoc = readJson(visitLogsPath, { version: 1, items: [] });
  visitDoc.items = cleanLogItems(visitDoc.items, keptSlugs);
  visitDoc.updatedAt = new Date().toISOString();

  const offerDoc = readJson(offerLogsPath, { version: 1, items: [] });
  offerDoc.items = cleanLogItems(offerDoc.items, keptSlugs);
  offerDoc.updatedAt = new Date().toISOString();

  writeJson(playersPath, keptPlayers);
  writeJson(eventsPath, filteredEvents);
  writeJson(intelPath, intelDoc);
  writeJson(visitLogsPath, visitDoc);
  writeJson(offerLogsPath, offerDoc);

  const c2026 = keptPlayers.filter((p) => Number(p.classYear) === 2026 && looksLikeFloridaCommit(p));
  const c2027 = keptPlayers.filter((p) => Number(p.classYear) === 2027 && looksLikeFloridaCommit(p));
  console.log('[clean-recruiting] players', players.length, '->', keptPlayers.length);
  console.log('[clean-recruiting] protected commits 2026:', c2026.length, '2027:', c2027.length);
  console.log('[clean-recruiting] events', events.length, '->', filteredEvents.length);
  console.log('[clean-recruiting] intel items', intelDoc.items.length);
}

main();
