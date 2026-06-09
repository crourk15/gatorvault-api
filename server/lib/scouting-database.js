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

/** Sync verified entry into legacy breakdowns.json for War Room UI */
function syncEntryToBreakdown(entry) {
  if (!entry) return null;
  const warRoom = require('./war-room-store');
  const sents = sentencesFromSummary(entry.scoutingSummary);
  const weaknessHints = sents.filter((s) =>
    /\b(question|need to|will need|remains a|lack of|concern|limited|raw)\b/i.test(s)
  );
  const strengthHints = sents.filter((s) => !weaknessHints.includes(s) && s.length > 25);

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
    comparison: null,
    schemeFit: null,
    staffNotes: null,
    projection: sents.find((s) => /project|upside|impact|ceiling|floor/i.test(s)) || null,
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
    if (!nflHit && !collegeHit) return null;

    const rules = analysts.analystsForPlayerType(player.playerType, player);
    let sourceType = nflHit ? 'NFL' : 'College';
    if (!rules.useNflFirst && sourceType === 'NFL') return null;
    if (sourceType === 'NFL' && !nflHit) sourceType = 'College';

    return normalizeEntry(player, {
      analystName: (sourceType === 'NFL' ? nflHit : collegeHit).name,
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

async function rebuildScoutingDatabase({ delayMs = 400, onProgress } = {}) {
  const players = collectAllPlayers();
  const doc = { version: 1, updatedAt: null, entries: {} };
  const log = {
    startedAt: new Date().toISOString(),
    finishedAt: null,
    total: players.length,
    stored: 0,
    blank: 0,
    errors: [],
    byType: { recruit: 0, commit: 0, portal: 0, target: 0, roster: 0 }
  };

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    if (onProgress) onProgress({ index: i + 1, total: players.length, slug: player.slug });

    try {
      const raw = await fetcher.findVerifiedScouting(player);
      let entry = raw ? normalizeEntry(player, raw) : null;
      if (!entry) entry = importLegacyBreakdown(player);
      if (entry) {
        doc.entries[entry.playerId] = entry;
        log.stored += 1;
        log.byType[entry.playerType] = (log.byType[entry.playerType] || 0) + 1;
        syncEntryToBreakdown(entry);
      } else {
        log.blank += 1;
      }
    } catch (e) {
      log.errors.push({ slug: player.slug, error: e.message });
      log.blank += 1;
    }

    if (delayMs > 0 && i < players.length - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  saveDatabase(doc);
  purgeUnlistedBreakdowns(new Set(Object.values(doc.entries).map((e) => e.playerSlug)));

  log.finishedAt = new Date().toISOString();
  writeJson(REBUILD_LOG_PATH, log);

  return {
    ok: true,
    ...log,
    entriesInDatabase: Object.keys(doc.entries).length
  };
}

module.exports = {
  DB_PATH,
  loadDatabase,
  saveDatabase,
  collectAllPlayers,
  normalizeEntry,
  getEntryBySlug,
  getAllEntries,
  listForApi,
  rebuildScoutingDatabase,
  syncEntryToBreakdown,
  playerIdFor
};
