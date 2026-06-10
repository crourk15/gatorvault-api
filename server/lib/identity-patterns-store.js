/**
 * recruiting_identity_patterns — auto-generated phrase index for contextual identity.
 */
const fs = require('fs');
const path = require('path');
const { buildPatternRecord, splitName, STAR_WORDS } = require('./identity-pattern-generator');

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

function validatePatternEntry(entry, player = null) {
  const missingPatterns = [];
  if (!entry?.slug) missingPatterns.push('slug');
  const name = entry?.name || player?.name || '';
  const { firstName, lastName } = splitName(name);
  if (!firstName || !lastName) missingPatterns.push('full_name');
  const patterns = Array.isArray(entry?.patterns) ? entry.patterns : [];
  if (patterns.length < 2) missingPatterns.push('pattern_count');

  if (firstName && lastName) {
    const full = `${firstName} ${lastName}`;
    if (!patterns.includes(full)) missingPatterns.push('full_name_pattern');
  }

  const stars = entry?.stars ?? player?.stars;
  const pos = entry?.position || player?.pos;
  if (stars && pos) {
    const posUp = String(pos).toUpperCase();
    const starWord = STAR_WORDS[parseInt(stars, 10)];
    const hasStarPos = patterns.some((p) => {
      const t = String(p);
      return (
        new RegExp(`${stars}[- ]?star\\s+${posUp}`, 'i').test(t) ||
        (starWord && new RegExp(`${starWord}[- ]star\\s+${posUp}`, 'i').test(t))
      );
    });
    if (!hasStarPos) missingPatterns.push('star_pos_pattern');
  }

  return {
    valid: missingPatterns.length === 0,
    missingPatterns,
    patternCount: patterns.length
  };
}

async function pruneStalePatternEntries(validSlugs) {
  const slugSet = new Set((validSlugs || []).filter(Boolean));
  const sb = initSupabase();
  if (sb) {
    const all = await listAllPatterns();
    let pruned = 0;
    for (const entry of all) {
      if (!slugSet.has(entry.slug)) {
        await deletePatternEntry(entry.slug);
        pruned += 1;
      }
    }
    return { pruned };
  }
  const doc = loadLocalDoc();
  let pruned = 0;
  for (const slug of Object.keys(doc.entries || {})) {
    if (!slugSet.has(slug)) {
      delete doc.entries[slug];
      pruned += 1;
    }
  }
  if (pruned) saveLocalDoc(doc);
  return { pruned };
}

async function syncPatternsForPlayer(player) {
  if (!player?.slug || !player?.name) return null;
  const identityValidator = require('./identity-record-validator');
  const playerValidation = identityValidator.validatePlayerIdentityRecord(player);
  if (!playerValidation.valid) {
    console.warn(
      '[identity-patterns] REJECTED invalid player identity:',
      player.slug,
      playerValidation.errors.join(', ')
    );
    return { rejected: true, validation: playerValidation, slug: player.slug };
  }
  const entry = buildPatternRecord(player);
  entry.updatedAt = nowIso();
  const validation = validatePatternEntry(entry, player);
  if (!validation.valid) {
    console.warn(
      '[identity-patterns] incomplete patterns for',
      player.slug,
      validation.missingPatterns.join(', ')
    );
    return { rejected: true, validation: { ...validation, playerErrors: playerValidation.errors }, slug: player.slug };
  }
  const toSave = { ...entry };
  delete toSave.validation;
  const saved = await upsertPatternEntry(toSave);
  saved.validation = validation;
  return saved;
}

async function rebuildAllPatterns({ players } = {}) {
  const started = Date.now();
  const store = require('./recruiting-store');
  const list = players || (await store.getAllPlayers());
  const validSlugs = [];
  let count = 0;
  let incomplete = 0;
  for (const player of list) {
    if (!player.slug || !player.name) continue;
    const entry = await syncPatternsForPlayer(player);
    validSlugs.push(player.slug);
    count += 1;
    if (entry?.validation && !entry.validation.valid) incomplete += 1;
  }
  const { pruned } = await pruneStalePatternEntries(validSlugs);
  const durationMs = Date.now() - started;
  return { ok: true, count, incomplete, pruned, durationMs, updatedAt: nowIso() };
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
  validatePatternEntry,
  pruneStalePatternEntries,
  syncPatternsForPlayer,
  rebuildAllPatterns,
  storageMode
};
