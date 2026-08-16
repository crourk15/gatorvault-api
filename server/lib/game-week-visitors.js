/**
 * Expected home-game visitors -> Chase card "Why we chase" visit labels.
 * Data: server/data/schedule/game-visitors-2026.json (same Alderman early look as Game Week keys).
 * API-only -- no Codemagic. Clear the slug from the JSON to remove from cards.
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

/** @returns {Map<string, string>} slug -> chase label (first upcoming game wins) */
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
  return [{ type: 'Game Day', label }, ...existing].slice(0, 4);
}

module.exports = {
  DOC_PATH,
  loadDoc,
  buildSlugLabelMap,
  expectedVisitLabelForSlug,
  mergeExpectedVisitHistory,
};
