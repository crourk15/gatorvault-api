/**
 * Standardized War Room Scouting Database.
 * Fields: analystName, sourceUrl, scoutingSummary, playerId, timestamp, sourceType
 */
const fs = require('fs');
const path = require('path');
const analysts = require('./scouting-analysts');
const fetcher = require('./scouting-fetcher');

const DATA_DIR = path.join(__dirname, '..', 'data', 'war-room');
const DB_PATH = path.join(DATA_DIR, 'scouting-database.json');
const REBUILD_LOG_PATH = path.join(DATA_DIR, 'scouting-rebuild-log.json');
const REBUILD_STATUS_PATH = path.join(DATA_DIR, 'scouting-rebuild-status.json');
const RECRUITING_PLAYERS_PATH = path.join(__dirname, '..', 'data', 'recruiting', 'players.json');

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function readRebuildStatus() {
  return readJson(REBUILD_STATUS_PATH, {
    running: false,
    phase: 'idle',
    startedAt: null,
    finishedAt: null,
    progress: null,
    lastRun: null,
    error: null
  });
}

function writeRebuildStatus(patch) {
  const prev = readRebuildStatus();
  const next = {
    ...prev,
    ...patch,
    updatedAt: new Date().toISOString()
  };
  writeJson(REBUILD_STATUS_PATH, next);
  return next;
}

function loadDatabase() {
  const doc = readJson(DB_PATH, { version: 1, updatedAt: null, entries: {} });
  doc.entries = doc.entries || {};
  return doc;
}

function saveDatabase(doc) {
  doc.updatedAt = new Date().toISOString();
  writeJson(DB_PATH, doc);
}

function playerIdFor(player) {
  return String(player.on3Id || player.id || player.slug || '').trim();
}

function classifyRecruitingPlayer(p) {
  if (p.category === 'portal' || p.status === 'portal_in' || p.transferInfo) return 'portal';
  if (p.committedTo === 'Florida' || p.status === 'committed') return 'commit';
  if (p.category === 'target') return 'target';
  return 'recruit';
}

function collectAllPlayers() {
  const rosterStore = require('./roster-store');
  const recruiting = readJson(RECRUITING_PLAYERS_PATH, []);
  const roster = rosterStore.getAllRosterPlayers();

  const bySlug = new Map();

  recruiting.forEach((p) => {
    if (!p?.slug || !p?.name) return;
    const playerType = classifyRecruitingPlayer(p);
    bySlug.set(p.slug, {
      slug: p.slug,
      name: p.name,
      on3Id: p.on3Id || null,
      on3ProfileUrl: p.on3ProfileUrl || null,
      recruit247Id: p.recruit247Id || p.rivals247Id || null,
      playerType,
      playerId: playerIdFor(p),
      pos: p.pos,
      year: p.classYear,
      classYear: p.classYear,
      category: p.category,
      committedTo: p.committedTo,
      transferInfo: p.transferInfo || null
    });
  });

  roster.forEach((p) => {
    if (!p?.slug || !p?.name) return;
    bySlug.set(p.slug, {
      slug: p.slug,
      name: p.name,
      on3Id: p.on3Id || null,
      on3ProfileUrl: p.on3ProfileUrl || null,
      recruit247Id: p.recruit247Id || null,
      playerType: 'roster',
      playerId: playerIdFor({ ...p, on3Id: p.on3Id }),
      pos: p.pos || p.position,
      year: p.year || p.class,
      classYear: p.year || p.class,
      category: 'roster',
      committedTo: 'Florida',
      draftEligible: analysts.isDraftEligible(p)
    });
  });

  return [...bySlug.values()];
}

function normalizeEntry(player, raw) {
  if (!raw?.scoutingSummary || !raw?.analystName || !raw?.sourceUrl) return null;

  const sourceType = raw.sourceType === 'NFL' ? 'NFL' : 'College';
  const validation = analysts.validateScoutingEntry({
    analystName: raw.analystName,
    sourceUrl: raw.sourceUrl,
    scoutingSummary: raw.scoutingSummary,
    sourceType
  });
  if (!validation.ok) return null;

  const summary = String(raw.scoutingSummary).trim();

  return {
    playerId: playerIdFor(player),
    playerSlug: player.slug,
    playerName: player.name,
    playerType: player.playerType,
    analystName: validation.analyst.name,
    sourceUrl: String(raw.sourceUrl).trim(),
    scoutingSummary: summary.slice(0, 8000),
    timestamp: raw.timestamp || new Date().toISOString(),
    sourceType,
    outlet: validation.outlet
  };
}

function sentencesFromSummary(summary) {
  return String(summary || '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
}

function syncEntryToBreakdown(entry) {
  if (!entry) return null;
  const warRoom = require('./war-room-store');
  const typedUpdates = Array.isArray(entry.updates) ? entry.updates : [];
  const sents = sentencesFromSummary(entry.scoutingSummary);
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
        /\b(question|need to|will need|remains a|lack of|concern|limited|raw)\b/i.test(s)
      );
  const strengthHints = fromUpdates.strengths.length
    ? fromUpdates.strengths
    : sents.filter((s) => !weaknessHints.includes(s) && s.length > 25);

  return warRoom.upsertBreakdown(entry.playerSlug, {
    playerSlug: entry.playerSlug,
    playerName: entry.playerName,
    playerType: entry.playerType,
    verified: true,
    featured: entry.playerType === 'recruit' || entry.playerType === 'commit' || entry.playerType === 'portal',
    sources: [
      {
        writer: entry.analystName,
        outlet: entry.outlet,
        url: entry.sourceUrl,
        publishedAt: entry.timestamp.slice(0, 10)
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
    nflProjection: entry.sourceType === 'NFL' ? entry.scoutingSummary.slice(0, 500) : null,
    updatedAt: entry.timestamp
  });
}

function purgeUnlistedBreakdowns(validSlugs) {
  const warRoom = require('./war-room-store');
  const all = warRoom.getAllBreakdowns();
  all.forEach((b) => {
    if (!validSlugs.has(b.playerSlug)) warRoom.deleteBreakdown(b.playerSlug);
  });
}

function getEntryBySlug(slug) {
  const doc = loadDatabase();
  return Object.values(doc.entries).find((e) => e.playerSlug === slug) || null;
}

function getAllEntries() {
  const doc = loadDatabase();
  return Object.values(doc.entries);
}

function listForApi({ playerType } = {}) {
  let rows = getAllEntries();
  if (playerType) rows = rows.filter((r) => r.playerType === playerType);
  return rows.sort((a, b) => String(a.playerName || '').localeCompare(String(b.playerName || '')));
}

function importLegacyBreakdown(player) {
  try {
    const warRoom = require('./war-room-store');
    const legacy = warRoom.getBreakdownBySlug(player.slug);
    if (!legacy?.verified || !legacy.insiderNotes) return null;
    const writer = legacy.sources?.[0]?.writer;
    const url = legacy.sources?.[0]?.url;
    if (!writer || !url) return null;

    const nflHit = analysts.resolveNflAnalyst(writer);
    const collegeHit = analysts.resolveCollegeAnalyst(writer);
    const rules = analysts.analystsForPlayerType(player.playerType, player);

    if (rules.useNflFirst) {
      if (!nflHit) return null;
    } else if (!collegeHit) {
      return null;
    }

    const sourceType = rules.useNflFirst ? 'NFL' : 'College';
    const analyst = sourceType === 'NFL' ? nflHit : collegeHit;

    return normalizeEntry(player, {
      analystName: analyst.name,
      sourceUrl: url,
      scoutingSummary: legacy.insiderNotes,
      sourceType,
      outlet: legacy.sources[0].outlet,
      timestamp: legacy.updatedAt || new Date().toISOString()
    });
  } catch {
    return null;
  }
}

async function rebuildScoutingDatabase(options = {}) {
  const engine = require('./scouting-update-engine');
  return engine.runContinuousScoutingUpdate({
    delayMs: options.delayMs,
    playerSlug: options.playerSlug || null,
    reason: options.reason || 'manual_rebuild',
    onProgress: options.onProgress
  });
}

module.exports = {
  DB_PATH,
  REBUILD_STATUS_PATH,
  REBUILD_LOG_PATH,
  loadDatabase,
  saveDatabase,
  readRebuildStatus,
  writeRebuildStatus,
  collectAllPlayers,
  normalizeEntry,
  getEntryBySlug,
  getAllEntries,
  listForApi,
  rebuildScoutingDatabase,
  syncEntryToBreakdown,
  playerIdFor
};
