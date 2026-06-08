const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data', 'war-room');
const BREAKDOWNS_PATH = path.join(DATA_DIR, 'breakdowns.json');

/** Verified insider sources for War Room scouting — no AI, no other writers */
const TRUSTED_WRITERS = [
  { id: 'power', name: 'Charles Power', aliases: ['charles power', 'chuck power'] },
  { id: 'bender', name: 'Corey Bender', aliases: ['corey bender', 'corey_bender'] },
  { id: 'ivins', name: 'Andrew Ivins', aliases: ['andrew ivins', 'jamie ivins', 'jamieivins'] },
  { id: 'alderman', name: 'Blake Alderman', aliases: ['blake alderman', 'blake_alderman'] },
  { id: 'wiltfong', name: 'Steve Wiltfong', aliases: ['steve wiltfong', 'stevewiltfong'] }
];

const TRUSTED_WRITER_NAMES = new Set(TRUSTED_WRITERS.map((w) => w.name.toLowerCase()));
const PLACEHOLDER_MESSAGE = 'No verified insider evaluation available.';

const PLAYER_TYPES = new Set(['recruit', 'portal', 'target', 'roster']);

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function loadDoc() {
  const doc = readJson(BREAKDOWNS_PATH, { version: 1, updatedAt: null, breakdowns: {} });
  doc.breakdowns = doc.breakdowns || {};
  return doc;
}

function saveDoc(doc) {
  doc.updatedAt = new Date().toISOString();
  writeJson(BREAKDOWNS_PATH, doc);
}

function normalizeWriterName(name) {
  return String(name || '').trim();
}

function isTrustedWriter(name) {
  const lower = normalizeWriterName(name).toLowerCase();
  if (!lower) return false;
  if (TRUSTED_WRITER_NAMES.has(lower)) return true;
  return TRUSTED_WRITERS.some((w) => w.aliases.some((a) => a === lower || lower.includes(a)));
}

function resolveTrustedWriter(name) {
  const lower = normalizeWriterName(name).toLowerCase();
  for (const w of TRUSTED_WRITERS) {
    if (w.name.toLowerCase() === lower) return w;
    if (w.aliases.some((a) => a === lower || lower.includes(a))) return w;
  }
  return null;
}

function normalizeStringList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  return String(value)
    .split(/\n|;/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function normalizeSource(raw) {
  const writer = normalizeWriterName(raw.writer || raw.name);
  const trusted = resolveTrustedWriter(writer);
  if (!trusted) return null;
  return {
    writer: trusted.name,
    writerId: trusted.id,
    outlet: String(raw.outlet || '').trim() || null,
    url: String(raw.url || '').trim() || null,
    publishedAt: raw.publishedAt || raw.date || null
  };
}

function hasScoutingContent(entry) {
  const fields = [
    'strengths',
    'weaknesses',
    'comparison',
    'schemeFit',
    'staffNotes',
    'projection',
    'insiderNotes',
    'recruitingStory',
    'nflProjection'
  ];
  return fields.some((key) => {
    const val = entry[key];
    if (Array.isArray(val)) return val.length > 0;
    return typeof val === 'string' && val.trim().length > 0;
  });
}

function normalizeBreakdown(raw, slug) {
  const playerSlug = String(raw.playerSlug || slug || '').trim();
  if (!playerSlug) throw new Error('playerSlug required');

  const playerType = String(raw.playerType || 'recruit').toLowerCase();
  if (!PLAYER_TYPES.has(playerType)) throw new Error('Invalid playerType');

  const sources = (raw.sources || [])
    .map(normalizeSource)
    .filter(Boolean);

  if (!sources.length) throw new Error('At least one trusted insider source required');

  const entry = {
    playerSlug,
    playerName: String(raw.playerName || '').trim() || null,
    playerType,
    verified: true,
    sources,
    strengths: normalizeStringList(raw.strengths),
    weaknesses: normalizeStringList(raw.weaknesses),
    comparison: String(raw.comparison || '').trim() || null,
    schemeFit: String(raw.schemeFit || raw.scheme_fit || '').trim() || null,
    staffNotes: String(raw.staffNotes || raw.staff_notes || '').trim() || null,
    projection: String(raw.projection || '').trim() || null,
    insiderNotes: String(raw.insiderNotes || raw.insider_notes || '').trim() || null,
    recruitingStory: String(raw.recruitingStory || raw.recruiting_story || '').trim() || null,
    nflProjection: String(raw.nflProjection || raw.nfl_projection || '').trim() || null,
    updatedAt: raw.updatedAt || new Date().toISOString()
  };

  if (!hasScoutingContent(entry)) {
    throw new Error('Breakdown must include at least one scouting field');
  }

  return entry;
}

function getBreakdownBySlug(slug) {
  const doc = loadDoc();
  return doc.breakdowns[slug] || null;
}

function getAllBreakdowns() {
  const doc = loadDoc();
  return Object.values(doc.breakdowns);
}

function upsertBreakdown(slug, raw) {
  const entry = normalizeBreakdown(raw, slug);
  const doc = loadDoc();
  doc.breakdowns[entry.playerSlug] = entry;
  saveDoc(doc);
  return entry;
}

function deleteBreakdown(slug) {
  const doc = loadDoc();
  if (!doc.breakdowns[slug]) return false;
  delete doc.breakdowns[slug];
  saveDoc(doc);
  return true;
}

function buildBreakdownResponse(slug) {
  const entry = getBreakdownBySlug(slug);
  if (entry && entry.verified) {
    return {
      ok: true,
      tier: 'war',
      locked: false,
      available: true,
      playerSlug: slug,
      breakdown: entry
    };
  }

  try {
    const rosterStore = require('./roster-store');
    const player = rosterStore.getRosterPlayerBySlug(slug);
    if (player && (player.strengths || player.weaknesses || player.projection || player.schemeFit)) {
      return {
        ok: true,
        tier: 'war',
        locked: false,
        available: true,
        playerSlug: slug,
        breakdown: {
          playerSlug: slug,
          playerName: player.name,
          playerType: 'roster',
          verified: true,
          sources: [{ writer: 'GatorVault Roster Intel', outlet: 'GatorVault', url: null }],
          strengths: Array.isArray(player.strengths) ? player.strengths : [],
          weaknesses: Array.isArray(player.weaknesses) ? player.weaknesses : [],
          projection: player.projection || null,
          schemeFit: player.schemeFit || null,
          comparison: null,
          staffNotes: null,
          insiderNotes: null,
          recruitingStory: null,
          nflProjection: null,
          updatedAt: player.updatedAt || new Date().toISOString()
        }
      };
    }
  } catch (e) {
    /* roster fallback optional */
  }

  return {
    ok: true,
    tier: 'war',
    locked: false,
    available: false,
    playerSlug: slug,
    message: PLACEHOLDER_MESSAGE
  };
}

function buildLockedResponse(slug) {
  const hasEvaluation = !!getBreakdownBySlug(slug);
  return {
    ok: true,
    tier: 'war',
    locked: true,
    available: false,
    hasEvaluation,
    playerSlug: slug,
    message: 'War Room scouting reports are exclusive to War Room members.'
  };
}

module.exports = {
  TRUSTED_WRITERS,
  PLACEHOLDER_MESSAGE,
  isTrustedWriter,
  getBreakdownBySlug,
  getAllBreakdowns,
  upsertBreakdown,
  deleteBreakdown,
  buildBreakdownResponse,
  buildLockedResponse
};
