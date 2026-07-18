/**
 * Durable Lab promotion stages — watchlist vs full Lab board.
 * Survives Render redeploys when /var/data is mounted.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const BUNDLE_PATH = path.join(__dirname, '..', 'data', 'recruiting', 'lab-promotions.json');

function resolvePath() {
  const fromEnv = String(process.env.GV_LAB_PROMOTIONS_PATH || '').trim();
  if (fromEnv) return fromEnv;
  const fcDir = String(process.env.GV_FUTURECAST_DATA_DIR || '').trim();
  if (fcDir) return path.join(path.dirname(fcDir), 'recruiting', 'lab-promotions.json');
  try {
    if (process.env.NODE_ENV === 'production' && fs.existsSync('/var/data')) {
      return '/var/data/recruiting/lab-promotions.json';
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
    watchlist: {},
    lab: {},
  };
}

function migrateIfNeeded() {
  if (path.resolve(STORE_PATH) === path.resolve(BUNDLE_PATH)) return;
  if (fs.existsSync(STORE_PATH)) return;
  if (!fs.existsSync(BUNDLE_PATH)) return;
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.copyFileSync(BUNDLE_PATH, STORE_PATH);
    console.log('[lab-promotions] migrated →', STORE_PATH);
  } catch (err) {
    console.warn('[lab-promotions] migrate failed:', err.message);
  }
}

function readDoc() {
  migrateIfNeeded();
  try {
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    return {
      version: 1,
      updatedAt: raw.updatedAt || null,
      watchlist: raw.watchlist && typeof raw.watchlist === 'object' ? raw.watchlist : {},
      lab: raw.lab && typeof raw.lab === 'object' ? raw.lab : {},
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

function normalizeSlug(slug) {
  return String(slug || '').trim().toLowerCase();
}

function getLabSlugSet(classYear) {
  const year = parseInt(classYear, 10);
  const doc = readDoc();
  const out = new Set();
  for (const [slug, row] of Object.entries(doc.lab || {})) {
    if (year && Number(row?.classYear) !== year) continue;
    out.add(normalizeSlug(slug));
  }
  return out;
}

function getWatchlistSlugSet(classYear) {
  const year = parseInt(classYear, 10);
  const doc = readDoc();
  const out = new Set();
  for (const [slug, row] of Object.entries(doc.watchlist || {})) {
    if (year && Number(row?.classYear) !== year) continue;
    // Lab members are also "watched" but board uses lab set.
    out.add(normalizeSlug(slug));
  }
  return out;
}

function upsertStage(stage, entry) {
  const slug = normalizeSlug(entry?.slug);
  if (!slug || (stage !== 'watchlist' && stage !== 'lab')) {
    return { ok: false, reason: 'invalid' };
  }
  const year = parseInt(entry.classYear, 10);
  if (year !== 2027 && year !== 2028) {
    return { ok: false, reason: 'class_year', slug };
  }
  const doc = readDoc();
  const prev = doc[stage][slug] || {};
  const reasons = [
    ...new Set([...(prev.reasons || []), ...(entry.reasons || [])].map(String).filter(Boolean)),
  ];
  const sources = [
    ...new Set([...(prev.sources || []), ...(entry.sources || [])].map(String).filter(Boolean)),
  ];
  doc[stage][slug] = {
    slug,
    name: String(entry.name || prev.name || slug).trim(),
    classYear: year,
    reasons,
    sources,
    promotedAt: prev.promotedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    stage,
  };
  // Promoting to Lab removes from watchlist-only staging.
  if (stage === 'lab' && doc.watchlist[slug]) {
    delete doc.watchlist[slug];
  }
  writeDoc(doc);
  return { ok: true, slug, stage, row: doc[stage][slug], created: !prev.promotedAt };
}

function getStoreInfo() {
  const doc = readDoc();
  return {
    path: STORE_PATH,
    durable:
      Boolean(String(process.env.GV_LAB_PROMOTIONS_PATH || '').trim()) ||
      String(STORE_PATH).startsWith('/var/data'),
    updatedAt: doc.updatedAt,
    watchlistCount: Object.keys(doc.watchlist || {}).length,
    labCount: Object.keys(doc.lab || {}).length,
  };
}

module.exports = {
  STORE_PATH,
  BUNDLE_PATH,
  readDoc,
  writeDoc,
  getLabSlugSet,
  getWatchlistSlugSet,
  upsertStage,
  getStoreInfo,
  normalizeSlug,
};
