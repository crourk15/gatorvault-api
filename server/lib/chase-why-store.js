/**
 * Editable Why we chase overrides — live on HP API (no Codemagic).
 * Durable: /var/data/recruiting/chase-why-overrides.json
 * Seed: server/data/recruiting/chase-why-overrides.json
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SEED_PATH = path.join(__dirname, '../data/recruiting/chase-why-overrides.json');
const DURABLE_DIR = '/var/data/recruiting';
const DURABLE_PATH = path.join(DURABLE_DIR, 'chase-why-overrides.json');

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
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function resolvePath() {
  if (fs.existsSync(DURABLE_PATH)) return DURABLE_PATH;
  if (fs.existsSync(SEED_PATH)) return SEED_PATH;
  return DURABLE_PATH;
}

function loadDoc() {
  const raw = readJson(resolvePath()) || readJson(SEED_PATH) || emptyDoc();
  const bySlug = {};
  const src = raw.bySlug && typeof raw.bySlug === 'object' ? raw.bySlug : {};
  for (const [k, v] of Object.entries(src)) {
    const slug = slugKey(k);
    const text = String(v?.text || v || '').trim();
    if (!slug || !text) continue;
    bySlug[slug] = {
      text,
      updatedAt: v?.updatedAt || raw.updatedAt || null,
      updatedBy: v?.updatedBy || null,
    };
  }
  return { version: 1, updatedAt: raw.updatedAt || null, bySlug };
}

function writeDoc(doc) {
  const out = {
    version: 1,
    updatedAt: new Date().toISOString(),
    bySlug: doc.bySlug || {},
  };
  try {
    fs.mkdirSync(DURABLE_DIR, { recursive: true });
    fs.writeFileSync(DURABLE_PATH, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
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

  const doc = loadDoc();
  doc.bySlug[key] = {
    text: clean,
    updatedAt: new Date().toISOString(),
    updatedBy: opts.updatedBy || null,
  };
  writeDoc(doc);
  return doc.bySlug[key];
}

function clearOverride(slug) {
  const key = slugKey(slug);
  if (!key) return false;
  const doc = loadDoc();
  if (!doc.bySlug[key]) return false;
  delete doc.bySlug[key];
  writeDoc(doc);
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
};
