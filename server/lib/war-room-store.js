const fs = require('fs');
const path = require('path');
const { COLLEGE_ANALYSTS, NFL_ANALYSTS } = require('./scouting-analysts');

const DATA_DIR = path.join(__dirname, '..', 'data', 'war-room');
const BREAKDOWNS_PATH = path.join(DATA_DIR, 'breakdowns.json');

/** Verified scouting analysts only — no beat writers */
const TRUSTED_WRITERS = [...COLLEGE_ANALYSTS, ...NFL_ANALYSTS];

const TRUSTED_WRITER_NAMES = new Set(TRUSTED_WRITERS.map((w) => w.name.toLowerCase()));
const PLACEHOLDER_MESSAGE = 'No verified insider evaluation available.';

const PLAYER_TYPES = new Set(['recruit', 'commit', 'portal', 'target', 'roster']);

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
    featured: !!(raw.featured ?? raw.isFeatured ?? raw.warRoomFeatured),
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

function rosterToBreakdownSummary(player) {
  return {
    playerSlug: player.slug,
    playerName: player.name,
    playerType: 'roster',
    featured: !!player.warRoomFeatured,
    verified: true,
    sources: [{ writer: 'GatorVault Roster Intel', writerId: 'roster', outlet: 'GatorVault' }],
    updatedAt: player.updatedAt || new Date().toISOString()
  };
}

function breakdownToSummary(entry) {
  return {
    playerSlug: entry.playerSlug,
    playerName: entry.playerName,
    playerType: entry.playerType,
    featured: !!entry.featured,
    verified: !!entry.verified,
    analystName: entry.analystName || (entry.sources && entry.sources[0]?.writer) || null,
    sourceType: entry.sourceType || null,
    sources: (entry.sources || []).map((s) => s.writer),
    updatedAt: entry.updatedAt || entry.timestamp
  };
}

function scoutingEntryToSummary(entry) {
  return {
    playerSlug: entry.playerSlug,
    playerName: entry.playerName,
    playerType: entry.playerType,
    featured: entry.playerType === 'recruit' || entry.playerType === 'portal',
    verified: true,
    analystName: entry.analystName,
    sourceType: entry.sourceType,
    sourceUrl: entry.sourceUrl,
    sources: [entry.analystName],
    updatedAt: entry.timestamp
  };
}

/** Scouting DB = standardized verified entries only */
function getScoutingDatabaseList() {
  try {
    const scoutingDb = require('./scouting-database');
    const rows = scoutingDb.listForApi();
    if (rows.length) return rows.map(scoutingEntryToSummary);
  } catch {
    /* fall through */
  }

  const breakdowns = getAllBreakdowns().map(breakdownToSummary);
  const slugSet = new Set(breakdowns.map((b) => b.playerSlug));

  try {
    const rosterStore = require('./roster-store');
    const rosterFeatured = rosterStore
      .getAllRosterPlayers()
      .filter(
        (p) =>
          p.warRoomFeatured &&
          !slugSet.has(p.slug) &&
          (p.strengths?.length || p.projection || p.schemeFit)
      )
      .map(rosterToBreakdownSummary);
    return [...breakdowns, ...rosterFeatured].sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return String(a.playerName || '').localeCompare(String(b.playerName || ''));
    });
  } catch {
    return breakdowns;
  }
}

function syncFeaturedRosterFlag(entry) {
  if (!entry?.featured || entry.playerType !== 'roster') return;
  try {
    const rosterStore = require('./roster-store');
    rosterStore.setWarRoomFeatured(entry.playerSlug, true);
  } catch {
    /* optional */
  }
}

function upsertBreakdown(slug, raw) {
  const entry = normalizeBreakdown(raw, slug);
  const doc = loadDoc();
  doc.breakdowns[entry.playerSlug] = entry;
  saveDoc(doc);
  syncFeaturedRosterFlag(entry);
  return entry;
}

function deleteBreakdown(slug) {
  const doc = loadDoc();
  if (!doc.breakdowns[slug]) return false;
  delete doc.breakdowns[slug];
  saveDoc(doc);
  return true;
}

function scoutingEntryToBreakdown(entry) {
  const typedUpdates = Array.isArray(entry.updates) ? entry.updates : [];
  const sents = String(entry.scoutingSummary || '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
  const fromUpdates = {
    strengths: typedUpdates.filter((u) => u.type === 'Strengths').map((u) => u.content),
    weaknesses: typedUpdates.filter((u) => u.type === 'Weaknesses').map((u) => u.content),
    comparison: typedUpdates.find((u) => u.type === 'Comparison')?.content || null,
    schemeFit: typedUpdates.find((u) => u.type === 'Scheme Fit')?.content || null,
    projection: typedUpdates.find((u) => u.type === 'Projection')?.content || null
  };
  const weaknessHints = fromUpdates.weaknesses.length
    ? fromUpdates.weaknesses
    : sents.filter((s) =>
        /\b(question|need to|will need|remains a|lack of|concern|limited)\b/i.test(s)
      );
  const strengthHints = fromUpdates.strengths.length
    ? fromUpdates.strengths
    : sents.filter((s) => !weaknessHints.includes(s) && s.length > 25);

  return {
    playerSlug: entry.playerSlug,
    playerName: entry.playerName,
    playerType: entry.playerType,
    verified: true,
    analystName: entry.analystName,
    sourceType: entry.sourceType,
    sources: [
      {
        writer: entry.analystName,
        writerId: entry.analystName.toLowerCase().replace(/\s+/g, '-'),
        outlet: entry.outlet,
        url: entry.sourceUrl,
        publishedAt: entry.timestamp?.slice(0, 10) || null
      }
    ],
    strengths: strengthHints.slice(0, 8),
    weaknesses: weaknessHints.slice(0, 4),
    comparison: fromUpdates.comparison,
    schemeFit: fromUpdates.schemeFit,
    staffNotes: typedUpdates.find((u) => u.type === 'Insider Notes')?.content || null,
    projection:
      fromUpdates.projection ||
      sents.find((s) => /project|upside|impact|ceiling|floor/i.test(s)) ||
      null,
    insiderNotes: entry.scoutingSummary,
    recruitingStory: null,
    nflProjection: entry.sourceType === 'NFL' ? entry.scoutingSummary.slice(0, 600) : null,
    updatedAt: entry.timestamp,
    scoutingUpdates: typedUpdates.slice(0, 20)
  };
}

function buildBreakdownResponse(slug) {
  try {
    const scoutingDb = require('./scouting-database');
    const scoutingEntry = scoutingDb.getEntryBySlug(slug);
    if (scoutingEntry) {
      return {
        ok: true,
        tier: 'war',
        locked: false,
        available: true,
        playerSlug: slug,
        breakdown: scoutingEntryToBreakdown(scoutingEntry)
      };
    }
  } catch {
    /* optional */
  }

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
          verified: false,
          sources: [],
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
  getScoutingDatabaseList,
  breakdownToSummary,
  upsertBreakdown,
  deleteBreakdown,
  buildBreakdownResponse,
  buildLockedResponse
};
