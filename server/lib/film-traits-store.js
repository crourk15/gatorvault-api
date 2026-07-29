'use strict';

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../data/recruiting/film-traits.json');

function emptyDoc() {
  return {
    updatedAt: new Date().toISOString(),
    notes: 'Curated Hudl / On3 highlight traits for Beat Desk Copy Brief.',
    bySlug: {},
  };
}

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function loadFilmTraitsDoc() {
  try {
    if (!fs.existsSync(DATA_PATH)) return emptyDoc();
    const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    if (!raw || typeof raw !== 'object') return emptyDoc();
    return {
      updatedAt: raw.updatedAt || null,
      notes: raw.notes || '',
      bySlug: raw.bySlug && typeof raw.bySlug === 'object' ? raw.bySlug : {},
    };
  } catch {
    return emptyDoc();
  }
}

function saveFilmTraitsDoc(doc) {
  const next = {
    updatedAt: new Date().toISOString(),
    notes: doc?.notes || 'Curated Hudl / On3 highlight traits for Beat Desk Copy Brief.',
    bySlug: doc?.bySlug && typeof doc.bySlug === 'object' ? doc.bySlug : {},
  };
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

function getFilmTraitsBySlug(slug) {
  const key = normalizeSlug(slug);
  if (!key) return null;
  const doc = loadFilmTraitsDoc();
  const entry = doc.bySlug[key];
  if (!entry || typeof entry !== 'object') return null;
  return { slug: key, ...entry };
}

function resolveFilmTraits({ slug, playerName, aliases = [] } = {}) {
  const doc = loadFilmTraitsDoc();
  const bySlug = doc.bySlug || {};

  const tryKeys = [
    normalizeSlug(slug),
    normalizeSlug(playerName),
    ...aliases.map((a) => normalizeSlug(a)),
  ].filter(Boolean);

  for (const key of tryKeys) {
    if (bySlug[key]) return { slug: key, ...bySlug[key] };
  }

  // Loose name match against stored playerName
  const nameNeedle = String(playerName || '').trim().toLowerCase();
  if (nameNeedle) {
    for (const [key, entry] of Object.entries(bySlug)) {
      const stored = String(entry?.playerName || '').trim().toLowerCase();
      if (!stored) continue;
      if (stored === nameNeedle || nameNeedle.includes(stored) || stored.includes(nameNeedle)) {
        return { slug: key, ...entry };
      }
    }
  }

  return null;
}

function upsertFilmTraits(slug, payload = {}) {
  const key = normalizeSlug(slug || payload.playerName);
  if (!key) {
    const err = new Error('slug or playerName required');
    err.statusCode = 400;
    throw err;
  }

  const doc = loadFilmTraitsDoc();
  const prev = doc.bySlug[key] && typeof doc.bySlug[key] === 'object' ? doc.bySlug[key] : {};

  const nextEntry = {
    playerName: String(payload.playerName || prev.playerName || key).trim(),
    position: payload.position != null ? String(payload.position).trim() : prev.position || null,
    classYear: payload.classYear != null ? Number(payload.classYear) || null : prev.classYear || null,
    sources: Array.isArray(payload.sources) ? payload.sources : prev.sources || [],
    traits: Array.isArray(payload.traits)
      ? payload.traits.map((t) => String(t || '').trim()).filter(Boolean)
      : prev.traits || [],
    vaultFilmAngle:
      payload.vaultFilmAngle != null
        ? String(payload.vaultFilmAngle).trim()
        : prev.vaultFilmAngle || '',
    doNotClaim: Array.isArray(payload.doNotClaim)
      ? payload.doNotClaim.map((t) => String(t || '').trim()).filter(Boolean)
      : prev.doNotClaim || [],
    clipNotes:
      payload.clipNotes != null ? String(payload.clipNotes).trim() : prev.clipNotes || '',
    ingestStatus:
      payload.ingestStatus != null ? String(payload.ingestStatus).trim() : prev.ingestStatus || null,
    on3RecruitSlug:
      payload.on3RecruitSlug != null
        ? String(payload.on3RecruitSlug).trim()
        : prev.on3RecruitSlug || null,
    on3ProfileUrl:
      payload.on3ProfileUrl != null
        ? String(payload.on3ProfileUrl).trim()
        : prev.on3ProfileUrl || null,
    lastIngestAt:
      payload.lastIngestAt != null ? String(payload.lastIngestAt).trim() : prev.lastIngestAt || null,
    evaluatedBy:
      payload.evaluatedBy != null ? String(payload.evaluatedBy).trim() : prev.evaluatedBy || null,
    evalMode: payload.evalMode != null ? String(payload.evalMode).trim() : prev.evalMode || null,
    evaluatedAt:
      payload.evaluatedAt != null ? String(payload.evaluatedAt).trim() : prev.evaluatedAt || null,
  };

  doc.bySlug[key] = nextEntry;
  const saved = saveFilmTraitsDoc(doc);
  return { slug: key, ...saved.bySlug[key] };
}

function listFilmTraits() {
  const doc = loadFilmTraitsDoc();
  return Object.entries(doc.bySlug || {}).map(([slug, entry]) => ({ slug, ...entry }));
}

module.exports = {
  DATA_PATH,
  normalizeSlug,
  loadFilmTraitsDoc,
  saveFilmTraitsDoc,
  getFilmTraitsBySlug,
  resolveFilmTraits,
  upsertFilmTraits,
  listFilmTraits,
};
