#!/usr/bin/env node
/**
 * Clean recruiting JSON stores for hub accuracy:
 * - Active hub classes: 2027–2029 targets/commits only
 * - Drop enrolled portal / 2026 cycle / stale events
 */
const fs = require('fs');
const path = require('path');
const { isBlockedRecruit } = require('../lib/recruiting-blocked-players');

const DATA_DIR = path.join(__dirname, '..', 'data', 'recruiting');
const HUB_CLASS_YEARS = new Set([2027, 2028, 2029]);

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
  // Fix missing object opener after first manual commit insert (line ~40).
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

function eventClassYear(evt) {
  const fromTop = Number(evt.classYear);
  if (HUB_CLASS_YEARS.has(fromTop)) return fromTop;
  const fromPayload = Number(evt.payload?.player?.classYear);
  if (HUB_CLASS_YEARS.has(fromPayload)) return fromPayload;
  return fromTop || fromPayload || null;
}

function isHubEligiblePlayer(player) {
  if (!player || isBlockedRecruit(player)) return false;
  const slug = String(player.slug || '').toLowerCase();
  if (!slug) return false;

  const year = Number(player.classYear);
  if (!HUB_CLASS_YEARS.has(year)) return false;

  const status = String(player.status || '').toLowerCase();
  if (status === 'enrolled') return false;

  const cat = String(player.category || '').toLowerCase();
  if (cat === 'portal') return false;

  const lc = String(player.lifecycle || '').toUpperCase();
  if (lc === 'ROSTER') return false;

  return true;
}

function shouldRemoveEvent(evt, removedSlugs) {
  const slug = String(evt.playerSlug || evt.playerId || '').toLowerCase();
  if (!slug || removedSlugs.has(slug)) return true;
  if (isBlockedRecruit({ slug, name: evt.title })) return true;

  const year = eventClassYear(evt);
  if (!HUB_CLASS_YEARS.has(year)) return true;

  return false;
}

function dedupeEvents(events) {
  const seen = new Map();
  const out = [];
  for (const evt of events) {
    const slug = String(evt.playerSlug || evt.playerId || '').toLowerCase();
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

function cleanIntelItems(items, removedSlugs) {
  return (items || []).filter((row) => {
    const slug = String(row.playerSlug || row.player_slug || '').toLowerCase();
    if (!slug || removedSlugs.has(slug)) return false;
    if (isBlockedRecruit({ slug, name: row.playerName })) return false;
    const year = Number(row.classYear);
    if (year && !HUB_CLASS_YEARS.has(year)) return false;
    return true;
  });
}

function cleanLogItems(items, removedSlugs) {
  return (items || []).filter((row) => {
    const slug = String(row.playerSlug || '').toLowerCase();
    return slug && !removedSlugs.has(slug) && !isBlockedRecruit({ slug, name: row.playerName });
  });
}

function main() {
  const playersPath = path.join(DATA_DIR, 'players.json');
  const eventsPath = path.join(DATA_DIR, 'events.json');
  const intelPath = path.join(DATA_DIR, 'intel.json');
  const visitLogsPath = path.join(DATA_DIR, 'visit_logs.json');
  const offerLogsPath = path.join(DATA_DIR, 'offer_logs.json');

  const players = readJson(playersPath, []);
  const keptPlayers = players.filter(isHubEligiblePlayer);
  const removedSlugs = new Set(
    players
      .filter((p) => !isHubEligiblePlayer(p))
      .map((p) => String(p.slug || '').toLowerCase())
      .filter(Boolean)
  );

  let events;
  try {
    events = loadEvents();
  } catch (err) {
    console.error('[clean-recruiting] events.json parse failed:', err.message);
    process.exit(1);
  }

  const filteredEvents = dedupeEvents(events.filter((evt) => !shouldRemoveEvent(evt, removedSlugs)));

  const intelDoc = readJson(intelPath, { version: 1, items: [] });
  intelDoc.items = cleanIntelItems(intelDoc.items, removedSlugs);
  intelDoc.updatedAt = new Date().toISOString();

  const visitDoc = readJson(visitLogsPath, { version: 1, items: [] });
  visitDoc.items = cleanLogItems(visitDoc.items, removedSlugs);
  visitDoc.updatedAt = new Date().toISOString();

  const offerDoc = readJson(offerLogsPath, { version: 1, items: [] });
  offerDoc.items = cleanLogItems(offerDoc.items, removedSlugs);
  offerDoc.updatedAt = new Date().toISOString();

  writeJson(playersPath, keptPlayers);
  writeJson(eventsPath, filteredEvents);
  writeJson(intelPath, intelDoc);
  writeJson(visitLogsPath, visitDoc);
  writeJson(offerLogsPath, offerDoc);

  console.log('[clean-recruiting] players', players.length, '->', keptPlayers.length);
  console.log('[clean-recruiting] removed slugs sample:', [...removedSlugs].slice(0, 12).join(', '));
  console.log('[clean-recruiting] cam-dooley removed:', removedSlugs.has('cam-dooley'));
  console.log('[clean-recruiting] events', events.length, '->', filteredEvents.length);
  console.log('[clean-recruiting] intel items', intelDoc.items.length);
  console.log('[clean-recruiting] visit_logs', visitDoc.items.length, 'offer_logs', offerDoc.items.length);
}

main();
