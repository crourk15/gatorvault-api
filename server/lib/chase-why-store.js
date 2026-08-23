/**
 * Editable Why we chase overrides — live on HP API (no Codemagic).
 * Seed: server/data/recruiting/chase-why-overrides.json (bundled handwrites)
 * Durable: /var/data/recruiting/chase-why-overrides.json (Admin live edits)
 *
 * loadDoc = seed ∪ durable (durable wins per slug).
 * Empty durable must NOT wipe the seed — that was why prod still showed generator copy.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SEED_PATH = path.join(__dirname, '../data/recruiting/chase-why-overrides.json');

function durableDir() {
  const override = String(process.env.CHASE_WHY_DURABLE_DIR || '').trim();
  if (override) return override;
  return '/var/data/recruiting';
}

function durablePath() {
  return path.join(durableDir(), 'chase-why-overrides.json');
}

/** @deprecated prefer durablePath(); kept for callers/tests */
const DURABLE_PATH = '/var/data/recruiting/chase-why-overrides.json';

function slugKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function emptyDoc() {
  return { version: 1, updatedAt: null, bySlug: {} };
}

function readJson(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function normalizeBySlug(raw) {
  const bySlug = {};
  const src = raw && raw.bySlug && typeof raw.bySlug === 'object' ? raw.bySlug : {};
  for (const [k, v] of Object.entries(src)) {
    const slug = slugKey(k);
    const text = String(v?.text || v || '').trim();
    if (!slug || !text) continue;
    bySlug[slug] = {
      text,
      updatedAt: v?.updatedAt || raw?.updatedAt || null,
      updatedBy: v?.updatedBy || null,
    };
  }
  return bySlug;
}

function resolvePath() {
  const dPath = durablePath();
  if (fs.existsSync(dPath)) return dPath;
  if (fs.existsSync(SEED_PATH)) return SEED_PATH;
  return dPath;
}

/** Seed ∪ durable — durable wins when both have the same slug. */
function loadDoc() {
  const seedRaw = readJson(SEED_PATH) || emptyDoc();
  const dPath = durablePath();
  const durableRaw = readJson(dPath);
  const seedBy = normalizeBySlug(seedRaw);
  const durableBy = durableRaw ? normalizeBySlug(durableRaw) : {};
  return {
    version: 1,
    updatedAt: (durableRaw && durableRaw.updatedAt) || seedRaw.updatedAt || null,
    bySlug: { ...seedBy, ...durableBy },
  };
}

function writeDoc(doc) {
  const out = {
    version: 1,
    updatedAt: new Date().toISOString(),
    bySlug: doc.bySlug || {},
  };
  const dDir = durableDir();
  const dPath = durablePath();
  try {
    fs.mkdirSync(dDir, { recursive: true });
    fs.writeFileSync(dPath, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  } catch {
    fs.mkdirSync(path.dirname(SEED_PATH), { recursive: true });
    fs.writeFileSync(SEED_PATH, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  }
  return out;
}

function getOverride(slug) {
  const key = slugKey(slug);
  if (!key) return null;
  const row = loadDoc().bySlug[key];
  const text = String(row?.text || '').trim();
  return text || null;
}

function upsertOverride(slug, text, opts = {}) {
  const key = slugKey(slug);
  const clean = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!key) throw new Error('slug required');
  if (!clean) throw new Error('text required');
  if (clean.length > 280) throw new Error('text too long (max 280)');

  // Persist durable as delta on top of seed (do not copy entire seed into durable).
  const durableRaw = readJson(durablePath()) || emptyDoc();
  const durableBy = normalizeBySlug(durableRaw);
  durableBy[key] = {
    text: clean,
    updatedAt: new Date().toISOString(),
    updatedBy: opts.updatedBy || null,
  };
  writeDoc({ bySlug: durableBy });
  return durableBy[key];
}

function clearOverride(slug) {
  const key = slugKey(slug);
  if (!key) return false;
  const durableRaw = readJson(durablePath());
  if (!durableRaw) return false;
  const durableBy = normalizeBySlug(durableRaw);
  if (!durableBy[key]) return false;
  delete durableBy[key];
  writeDoc({ bySlug: durableBy });
  return true;
}

function listOverrides() {
  return loadDoc();
}

module.exports = {
  SEED_PATH,
  DURABLE_PATH,
  getOverride,
  upsertOverride,
  clearOverride,
  listOverrides,
  loadDoc,
  durablePath,
};
