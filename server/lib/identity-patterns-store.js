/**
 * recruiting_identity_patterns — auto-generated phrase index for contextual identity.
 */
const fs = require('fs');
const path = require('path');
const { buildPatternRecord } = require('./identity-pattern-generator');

const DATA_DIR = path.join(__dirname, '..', 'data', 'recruiting');
const PATTERNS_PATH = path.join(DATA_DIR, 'identity-patterns.json');

let supabase = null;

function initSupabase() {
  if (supabase !== null) return supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    supabase = false;
    return false;
  }
  try {
    const { createClient } = require('@supabase/supabase-js');
    supabase = createClient(url, key);
    return supabase;
  } catch {
    supabase = false;
    return false;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  data.updatedAt = nowIso();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  return data;
}

function rowToEntry(row) {
  if (!row) return null;
  return {
    slug: row.slug,
    name: row.name,
    stars: row.stars != null ? Number(row.stars) : null,
    position: row.position || null,
    school: row.school || null,
    class: row.class_year != null ? Number(row.class_year) : null,
    patterns: Array.isArray(row.patterns) ? row.patterns : [],
    updatedAt: row.updated_at || null
  };
}

function entryToRow(entry) {
  return {
    slug: entry.slug,
    name: entry.name,
    stars: entry.stars,
    position: entry.position,
    school: entry.school,
    class_year: entry.class,
    patterns: entry.patterns || [],
    updated_at: entry.updatedAt || nowIso()
  };
}

function loadLocalDoc() {
  return readJson(PATTERNS_PATH, { version: 1, entries: {}, updatedAt: null });
}

function saveLocalDoc(doc) {
  writeJson(PATTERNS_PATH, doc);
}

async function getPatternBySlug(slug) {
  const sb = initSupabase();
  if (sb) {
    const { data, error } = await sb
      .from('recruiting_identity_patterns')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw error;
    return rowToEntry(data);
  }
  const doc = loadLocalDoc();
  return doc.entries?.[slug] || null;
}

async function listAllPatterns() {
  const sb = initSupabase();
  if (sb) {
    const { data, error } = await sb.from('recruiting_identity_patterns').select('*').order('slug');
    if (error) throw error;
    return (data || []).map(rowToEntry);
  }
  const doc = loadLocalDoc();
  return Object.values(doc.entries || {});
}

async function upsertPatternEntry(entry) {
  const sb = initSupabase();
  if (sb) {
    const { data, error } = await sb
      .from('recruiting_identity_patterns')
      .upsert(entryToRow(entry), { onConflict: 'slug' })
      .select()
      .single();
    if (error) throw error;
    return rowToEntry(data);
  }
  const doc = loadLocalDoc();
  doc.entries = doc.entries || {};
  doc.entries[entry.slug] = { ...entry, updatedAt: nowIso() };
  saveLocalDoc(doc);
  return doc.entries[entry.slug];
}

async function deletePatternEntry(slug) {
  const sb = initSupabase();
  if (sb) {
    const { error } = await sb.from('recruiting_identity_patterns').delete().eq('slug', slug);
    if (error) throw error;
    return { deleted: slug };
  }
  const doc = loadLocalDoc();
  delete doc.entries[slug];
  saveLocalDoc(doc);
  return { deleted: slug };
}

async function syncPatternsForPlayer(player) {
  if (!player?.slug || !player?.name) return null;
  const entry = buildPatternRecord(player);
  entry.updatedAt = nowIso();
  return upsertPatternEntry(entry);
}

async function rebuildAllPatterns({ players } = {}) {
  const started = Date.now();
  const store = require('./recruiting-store');
  const list = players || (await store.getAllPlayers());
  let count = 0;
  for (const player of list) {
    if (!player.slug || !player.name) continue;
    await syncPatternsForPlayer(player);
    count += 1;
  }
  const durationMs = Date.now() - started;
  return { ok: true, count, durationMs, updatedAt: nowIso() };
}

function storageMode() {
  return initSupabase() ? 'supabase' : 'local';
}

module.exports = {
  PATTERNS_PATH,
  getPatternBySlug,
  listAllPatterns,
  upsertPatternEntry,
  deletePatternEntry,
  syncPatternsForPlayer,
  rebuildAllPatterns,
  storageMode
};
