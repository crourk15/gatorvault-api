/**
 * Hook / CTA phrase cooldown — v1.1.1 uniqueness windows.
 */
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./discovery-core');

const STORE_PATH = path.join(DATA_DIR, 'voice-phrase-memory.json');
const HOOK_WINDOW_MS = parseInt(process.env.VOICE_HOOK_MEMORY_MS || String(24 * 60 * 60 * 1000), 10);
const CTA_WINDOW_MS = parseInt(process.env.VOICE_CTA_MEMORY_MS || String(48 * 60 * 60 * 1000), 10);

function enabled() {
  return process.env.VOICE_PHRASE_MEMORY !== 'false';
}

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return { hooks: [], ctas: [] };
  }
}

function writeStore(doc) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  doc.updatedAt = new Date().toISOString();
  fs.writeFileSync(STORE_PATH, JSON.stringify(doc, null, 2), 'utf8');
}

function normalizePhrase(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function wasUsedRecently(list, phrase, windowMs) {
  const key = normalizePhrase(phrase);
  if (!key) return false;
  const cutoff = Date.now() - windowMs;
  return (list || []).some(
    (e) => normalizePhrase(e.phrase) === key && new Date(e.usedAt || 0).getTime() >= cutoff
  );
}

function pickUnique(candidates, list, windowMs) {
  const pool = Array.isArray(candidates) ? candidates : [candidates];
  if (!enabled()) return pool[0] || null;
  for (const phrase of pool) {
    if (!wasUsedRecently(list, phrase, windowMs)) return phrase;
  }
  return null;
}

function recordHook(phrase) {
  if (!enabled() || !phrase) return;
  const doc = readStore();
  doc.hooks = [{ phrase: String(phrase).trim(), usedAt: new Date().toISOString() }, ...(doc.hooks || [])]
    .filter((e) => Date.now() - new Date(e.usedAt || 0).getTime() < HOOK_WINDOW_MS)
    .slice(0, 200);
  writeStore(doc);
}

function recordCta(phrase) {
  if (!enabled() || !phrase) return;
  const doc = readStore();
  doc.ctas = [{ phrase: String(phrase).trim(), usedAt: new Date().toISOString() }, ...(doc.ctas || [])]
    .filter((e) => Date.now() - new Date(e.usedAt || 0).getTime() < CTA_WINDOW_MS)
    .slice(0, 200);
  writeStore(doc);
}

function pickUniqueHook(candidates) {
  const doc = readStore();
  return pickUnique(candidates, doc.hooks, HOOK_WINDOW_MS);
}

function pickUniqueCta(candidates) {
  const doc = readStore();
  return pickUnique(candidates, doc.ctas, CTA_WINDOW_MS);
}

function hookRecentlyUsed(phrase) {
  return enabled() && wasUsedRecently(readStore().hooks, phrase, HOOK_WINDOW_MS);
}

function ctaRecentlyUsed(phrase) {
  return enabled() && wasUsedRecently(readStore().ctas, phrase, CTA_WINDOW_MS);
}

module.exports = {
  enabled,
  HOOK_WINDOW_MS,
  CTA_WINDOW_MS,
  pickUniqueHook,
  pickUniqueCta,
  hookRecentlyUsed,
  ctaRecentlyUsed,
  recordHook,
  recordCta,
  normalizePhrase
};
