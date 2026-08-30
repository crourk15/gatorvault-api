/**
 * Expected home-game visitors — Chase labels + Game Week panel.
 * Data: server/data/schedule/game-visitors-2026.json
 * API-only list edits — no Codemagic after the panel UI is baked.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DOC_PATH = path.join(__dirname, '..', 'data', 'schedule', 'game-visitors-2026.json');

let _cache = null;
let _mtime = 0;

function loadDoc() {
  try {
    const st = fs.statSync(DOC_PATH);
    if (_cache && st.mtimeMs === _mtime) return _cache;
    const raw = JSON.parse(fs.readFileSync(DOC_PATH, 'utf8'));
    _cache = raw && typeof raw === 'object' ? raw : { games: [] };
    _mtime = st.mtimeMs;
    return _cache;
  } catch {
    return { games: [] };
  }
}

/** @returns {Map<string, string>} slug → chase label (first upcoming game wins) */
function buildSlugLabelMap(doc = loadDoc()) {
  const map = new Map();
  const games = Array.isArray(doc?.games) ? doc.games : [];
  for (const game of games) {
    const label = String(game?.chaseLabel || '').trim();
    if (!label) continue;
    const slugs = Array.isArray(game?.slugs) ? game.slugs : [];
    for (const raw of slugs) {
      const slug = String(raw || '')
        .trim()
        .toLowerCase();
      if (!slug || map.has(slug)) continue;
      map.set(slug, label);
    }
  }
  return map;
}

function expectedVisitLabelForSlug(slug) {
  const key = String(slug || '')
    .trim()
    .toLowerCase();
  if (!key) return null;
  return buildSlugLabelMap().get(key) || null;
}

/**
 * Prepend Expected visit label onto visitHistory for Chase skinny.
 * Uses type Game Day so existing VisitBadge typing stays valid; label is fan-facing.
 */
function mergeExpectedVisitHistory(slug, visitHistory) {
  const label = expectedVisitLabelForSlug(slug);
  if (!label) return Array.isArray(visitHistory) ? visitHistory : [];
  const existing = Array.isArray(visitHistory) ? visitHistory.slice() : [];
  const already = existing.some((v) => String(v?.label || '').trim() === label);
  if (already) return existing;
  return [{ type: 'Game Day', label }, ...existing].slice(0, 8);
}

function titleCaseSlug(slug) {
  return String(slug || '')
    .split('-')
    .filter(Boolean)
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

function metaFromDoc(key, doc = loadDoc()) {
  const meta = doc?.visitorMeta && typeof doc.visitorMeta === 'object' ? doc.visitorMeta : null;
  if (!meta) return null;
  const row = meta[key];
  return row && typeof row === 'object' ? row : null;
}

function resolveVisitorRow(slug) {
  const key = String(slug || '')
    .trim()
    .toLowerCase();
  if (!key) return null;
  let name = titleCaseSlug(key);
  let position = null;
  let school = null;
  let stars = null;
  let classYear = null;
  try {
    const store = require('./recruiting-store');
    const p = typeof store.findBySlug === 'function' ? store.findBySlug(key) : null;
    if (p) {
      name = String(p.name || p.fullName || name).trim() || name;
      position = p.pos || p.position || null;
      school = p.school || p.highSchool || null;
      stars = p.stars != null && Number(p.stars) > 0 ? Number(p.stars) : null;
      classYear = p.classYear != null ? Number(p.classYear) : null;
    }
  } catch {
    /* optional */
  }
  // Fallback when slug is on the visitor list but missing from recruiting players.json
  if (!position || !school || !classYear || stars == null) {
    const meta = metaFromDoc(key);
    if (meta) {
      if (!name || name === titleCaseSlug(key)) {
        name = String(meta.name || name).trim() || name;
      }
      if (!position && meta.position) position = meta.position;
      if (!school && meta.school) school = meta.school;
      if (stars == null && meta.stars != null && Number(meta.stars) > 0) {
        stars = Number(meta.stars);
      }
      if (!classYear && meta.classYear != null) classYear = Number(meta.classYear);
    }
  }
  return {
    slug: key,
    name,
    position: position ? String(position) : null,
    school: school ? String(school) : null,
    stars,
    classYear: Number.isFinite(classYear) ? classYear : null,
  };
}

/**
 * Fan-facing Game Week panel payload for one schedule game id (e.g. fau).
 */
function visitorsPanelForGameId(gameId) {
  const id = String(gameId || '')
    .trim()
    .toLowerCase();
  if (!id) return null;
  const doc = loadDoc();
  const games = Array.isArray(doc?.games) ? doc.games : [];
  const game = games.find((g) => String(g?.gameId || '').trim().toLowerCase() === id);
  if (!game) return null;
  const seen = new Set();
  const visitors = [];
  for (const raw of Array.isArray(game.slugs) ? game.slugs : []) {
    const row = resolveVisitorRow(raw);
    if (!row || seen.has(row.slug)) continue;
    const aliasKey = row.slug.replace(/-/g, '');
    if ([...seen].some((s) => s.replace(/-/g, '') === aliasKey)) continue;
    seen.add(row.slug);
    visitors.push(row);
  }
  if (!visitors.length) return null;
  return {
    gameId: String(game.gameId),
    opponent: String(game.opponent || '').trim() || null,
    dateLabel: String(game.dateLabel || '').trim() || null,
    chaseLabel: String(game.chaseLabel || '').trim() || null,
    source: String(doc.source || '').trim() || null,
    visitors,
  };
}

/** Attach expectedVisitors onto each schedule game that has a list. */
function attachExpectedVisitorsToGames(games) {
  if (!Array.isArray(games)) return games;
  return games.map((g) => {
    if (!g || typeof g !== 'object') return g;
    const panel = visitorsPanelForGameId(g.id);
    if (!panel) {
      const next = { ...g };
      delete next.expectedVisitors;
      return next;
    }
    return { ...g, expectedVisitors: panel };
  });
}

module.exports = {
  DOC_PATH,
  loadDoc,
  buildSlugLabelMap,
  expectedVisitLabelForSlug,
  mergeExpectedVisitHistory,
  visitorsPanelForGameId,
  attachExpectedVisitorsToGames,
  resolveVisitorRow,
};
