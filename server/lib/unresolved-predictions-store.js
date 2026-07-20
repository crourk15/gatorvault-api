/**
 * Unresolved Predictions Queue — never silently drop RPM / crystal-ball teasers.
 * Durable on Render when /var/data is mounted.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BUNDLE_PATH = path.join(__dirname, '..', 'data', 'recruiting', 'unresolved-predictions-queue.json');
const MAX_ITEMS = 250;

function resolvePath() {
  const fromEnv = String(process.env.GV_UNRESOLVED_PREDICTIONS_PATH || '').trim();
  if (fromEnv) return fromEnv;
  try {
    if (process.env.NODE_ENV === 'production' && fs.existsSync('/var/data')) {
      return '/var/data/recruiting/unresolved-predictions-queue.json';
    }
  } catch {
    /* ignore */
  }
  return BUNDLE_PATH;
}

const STORE_PATH = resolvePath();

function emptyDoc() {
  return {
    version: 1,
    updatedAt: null,
    items: [],
  };
}

function migrateIfNeeded() {
  if (path.resolve(STORE_PATH) === path.resolve(BUNDLE_PATH)) return;
  if (fs.existsSync(STORE_PATH)) return;
  if (!fs.existsSync(BUNDLE_PATH)) return;
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.copyFileSync(BUNDLE_PATH, STORE_PATH);
    console.log('[unresolved-predictions] migrated →', STORE_PATH);
  } catch (err) {
    console.warn('[unresolved-predictions] migrate failed:', err.message);
  }
}

function readDoc() {
  migrateIfNeeded();
  try {
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    return {
      version: 1,
      updatedAt: raw.updatedAt || null,
      items: Array.isArray(raw.items) ? raw.items : [],
    };
  } catch {
    return emptyDoc();
  }
}

function writeDoc(doc) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  const next = { ...doc, updatedAt: new Date().toISOString() };
  const tmp = `${STORE_PATH}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`);
  fs.renameSync(tmp, STORE_PATH);
  return next;
}

function fingerprintFor(input = {}) {
  if (input.fingerprint) return String(input.fingerprint).slice(0, 180);
  const raw = [
    input.source || '',
    input.reason || '',
    input.url || '',
    input.title || '',
    String(input.textPreview || '').slice(0, 120),
  ]
    .join('|')
    .toLowerCase();
  return `upq_${crypto.createHash('sha1').update(raw).digest('hex').slice(0, 24)}`;
}

function byReason(items) {
  const out = {};
  for (const item of items) {
    const key = String(item.reason || 'unknown');
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

/**
 * Enqueue a prediction signal that could not be attached to a player.
 * Dedupes open items by fingerprint; refreshes metadata on repeat sightings.
 */
function enqueue(input = {}) {
  const now = new Date().toISOString();
  const fingerprint = fingerprintFor(input);
  const doc = readDoc();
  const existing = doc.items.find(
    (row) => row.fingerprint === fingerprint && String(row.status || '') === 'open'
  );

  if (existing) {
    existing.updatedAt = now;
    existing.seenCount = Number(existing.seenCount || 1) + 1;
    existing.lastSeenAt = now;
    if (input.textPreview) existing.textPreview = String(input.textPreview).slice(0, 320);
    if (input.title) existing.title = String(input.title).slice(0, 220);
    if (input.url) existing.url = String(input.url);
    writeDoc(doc);
    return { created: false, item: existing, fingerprint };
  }

  const item = {
    id: `upq_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`,
    status: 'open',
    reason: String(input.reason || 'unresolved_prediction'),
    source: String(input.source || 'unknown'),
    title: String(input.title || 'Unresolved prediction').slice(0, 220),
    textPreview: String(input.textPreview || '').slice(0, 320),
    url: input.url ? String(input.url) : null,
    handle: input.handle ? String(input.handle).toLowerCase() : null,
    writerName: input.writerName ? String(input.writerName) : null,
    eventType: input.eventType ? String(input.eventType) : 'prediction',
    playerNameHint: input.playerNameHint ? String(input.playerNameHint) : null,
    playerSlugHint: input.playerSlugHint ? String(input.playerSlugHint).toLowerCase() : null,
    classYearHint: input.classYearHint != null ? Number(input.classYearHint) || null : null,
    posHint: input.posHint ? String(input.posHint) : null,
    fingerprint,
    seenCount: 1,
    createdAt: now,
    updatedAt: now,
    lastSeenAt: now,
    resolvedAt: null,
    resolvedPlayerSlug: null,
    note: null,
  };

  doc.items = [item, ...doc.items].slice(0, MAX_ITEMS);
  writeDoc(doc);
  return { created: true, item, fingerprint };
}

function listItems({ status = 'open', limit = 50 } = {}) {
  const doc = readDoc();
  const want = status === 'all' ? null : String(status || 'open');
  const items = doc.items.filter((row) => (want ? String(row.status) === want : true));
  const capped = items.slice(0, Math.max(1, Math.min(200, Number(limit) || 50)));
  return {
    items: capped,
    total: items.length,
    openCount: doc.items.filter((r) => r.status === 'open').length,
    byReason: byReason(items),
    updatedAt: doc.updatedAt,
  };
}

function getItem(id) {
  const key = String(id || '');
  return readDoc().items.find((row) => row.id === key) || null;
}

function resolveItem(id, { playerSlug = null, note = null } = {}) {
  const doc = readDoc();
  const item = doc.items.find((row) => row.id === String(id || ''));
  if (!item) return { ok: false, error: 'not_found' };
  if (item.status !== 'open') return { ok: true, item, already: true };

  item.status = 'resolved';
  item.resolvedAt = new Date().toISOString();
  item.updatedAt = item.resolvedAt;
  item.resolvedPlayerSlug = playerSlug ? String(playerSlug).toLowerCase() : null;
  item.note = note ? String(note).slice(0, 400) : item.note;
  writeDoc(doc);
  return { ok: true, item };
}

function dismissItem(id, { note = null } = {}) {
  const doc = readDoc();
  const item = doc.items.find((row) => row.id === String(id || ''));
  if (!item) return { ok: false, error: 'not_found' };
  if (item.status !== 'open') return { ok: true, item, already: true };

  item.status = 'dismissed';
  item.resolvedAt = new Date().toISOString();
  item.updatedAt = item.resolvedAt;
  item.note = note ? String(note).slice(0, 400) : item.note || 'dismissed';
  writeDoc(doc);
  return { ok: true, item };
}

module.exports = {
  STORE_PATH,
  BUNDLE_PATH,
  enqueue,
  listItems,
  getItem,
  resolveItem,
  dismissItem,
  fingerprintFor,
  readDoc,
};
