/**
 * Sync soft plate for GET /api/futurecast/underclassmen when Tier B would
 * otherwise return empty status:building / deferred_rebuild.
 * Powers Lab "Names to know — 2029 & 2030" without awaiting Postgres.
 *
 * CRITICAL: never sync-parse full players.json here — that starved Render /ready
 * past 5s and crash-looped the API after #496. Use slim younger-prospects-soft.json.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { getAllowlistSet } = require('./recruiting-target-allowlist');
const { isActiveUfTarget } = require('./recruiting-target-filters');
const { sortUnderclassmenForWatchboard } = require('./underclassmen-discovery-enrich');

const EARLY_WATCHLIST_PATH = path.join(__dirname, '../data/futurecast/early-watchlist.json');
const YOUNGER_SOFT_PATH = path.join(__dirname, '../data/futurecast/younger-prospects-soft.json');
const DEFAULT_YEARS = [2028, 2029, 2030];

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function loadEarlyWatchEntries() {
  const doc = readJsonSafe(EARLY_WATCHLIST_PATH);
  return Array.isArray(doc && doc.entries) ? doc.entries : [];
}

/** Slim 2029/2030 identity rows — never full players.json. */
function loadYoungerSoftEntries() {
  const doc = readJsonSafe(YOUNGER_SOFT_PATH);
  return Array.isArray(doc && doc.entries) ? doc.entries : [];
}

function loadTargetBoardTargetsSync(classYear) {
  const boardPath = path.join(__dirname, `../data/recruiting/${classYear}-target-board.json`);
  const doc = readJsonSafe(boardPath);
  return Array.isArray(doc && doc.targets) ? doc.targets : [];
}

function softRowId(slug) {
  return `soft:${slug}`;
}

function softUnderclassmenRow(input) {
  const slug = String(input.slug || '').toLowerCase();
  const starsN = Number(input.stars);
  const stars = Number.isFinite(starsN) && starsN >= 1 ? Math.round(starsN) : null;
  const position = String(input.position || '')
    .trim()
    .toUpperCase();
  return {
    id: softRowId(slug),
    slug,
    name: String(input.name || slug),
    classYear: input.classYear,
    position: position || 'TBD',
    school: input.school ? String(input.school) : null,
    hometown: null,
    state: input.state ? String(input.state) : null,
    composite: 0,
    stars,
    natlRank: null,
    posRank: null,
    stateRank: null,
    ufConfidence: null,
    fitScore: null,
    trendDelta7d: null,
    volatility7d: 0,
    priority: input.tier === 'target' ? 'high' : 'low',
    committedTo: null,
    predictors: [],
    competingSchools: [],
    tier: input.tier,
    discoveryScore: input.discoveryScore != null ? Number(input.discoveryScore) : null,
    earlyMovement: null,
    allowlistTarget: Boolean(input.allowlistTarget),
  };
}

function bucketForYear(classYear, targets, watchlist) {
  const all = [...targets, ...watchlist];
  const earlyMovement = all
    .filter((p) => p.earlyMovement != null && Math.abs(p.earlyMovement) >= 0.02)
    .sort((a, b) => Math.abs(b.earlyMovement || 0) - Math.abs(a.earlyMovement || 0));
  return {
    classYear,
    targets,
    watchlist,
    earlyMovement,
    count: all.length,
  };
}

function buildUnderclassmenSoftPlate(years = DEFAULT_YEARS) {
  const earlyEntries = loadEarlyWatchEntries();
  const youngerSoft = loadYoungerSoftEntries();
  const classes = {};
  const flat = [];

  for (const year of years) {
    const bySlug = new Map();

    if (year === 2028) {
      const allow = getAllowlistSet(2028);
      const boardBySlug = new Map(
        loadTargetBoardTargetsSync(2028).map((t) => [String(t.slug || '').toLowerCase(), t])
      );
      for (const raw of allow) {
        const slug = String(raw || '').toLowerCase();
        if (!slug) continue;
        const board = boardBySlug.get(slug) || {};
        bySlug.set(
          slug,
          softUnderclassmenRow({
            slug,
            name: String(board.name || slug),
            classYear: 2028,
            position: String(board.pos || board.position || ''),
            school: board.school || null,
            state: board.state || null,
            stars: board.stars != null ? Number(board.stars) : null,
            tier: 'target',
            allowlistTarget: true,
          })
        );
      }
    }

    if (year === 2029 || year === 2030) {
      for (const entry of youngerSoft) {
        if (Number(entry.classYear) !== year) continue;
        const slug = String(entry.slug || '').toLowerCase();
        if (!slug || !isActiveUfTarget(entry)) continue;
        const tier =
          year === 2030 || entry.tier === 'watchlist' ? 'watchlist' : 'target';
        bySlug.set(
          slug,
          softUnderclassmenRow({
            slug,
            name: String(entry.name || slug),
            classYear: year,
            position: String(entry.pos || entry.position || ''),
            school: entry.school || null,
            state: entry.state || null,
            stars: entry.stars != null ? Number(entry.stars) : null,
            tier,
            discoveryScore: entry.discoveryScore,
          })
        );
      }

      for (const entry of earlyEntries) {
        if (Number(entry.classYear) !== year) continue;
        const slug = String(entry.slug || '').toLowerCase();
        if (!slug || bySlug.has(slug)) continue;
        const tier = year === 2030 || entry.tier === 'watchlist' ? 'watchlist' : 'target';
        bySlug.set(
          slug,
          softUnderclassmenRow({
            slug,
            name: String(entry.name || slug),
            classYear: year,
            position: String(entry.pos || entry.position || ''),
            school: entry.school || null,
            state: entry.state || null,
            stars: entry.stars != null ? Number(entry.stars) : null,
            tier,
            discoveryScore: entry.discoveryScore,
          })
        );
      }
    }

    const targets = [];
    const watchlist = [];
    for (const row of bySlug.values()) {
      if (row.tier === 'watchlist') watchlist.push(row);
      else targets.push(row);
    }
    classes[String(year)] = bucketForYear(year, targets, watchlist);
    flat.push(...targets, ...watchlist);
  }

  const updatedAt = new Date().toISOString();
  return {
    ok: true,
    updatedAt,
    years: [...years],
    classes,
    players: sortUnderclassmenForWatchboard(flat),
    empty: flat.length === 0,
    message: flat.length === 0 ? 'No underclassmen soft plate rows.' : undefined,
    degraded: 'soft_plate',
  };
}

module.exports = {
  buildUnderclassmenSoftPlate,
  loadYoungerSoftEntries,
  DEFAULT_YEARS,
};
