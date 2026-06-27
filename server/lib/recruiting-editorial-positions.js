/**
 * 2028 allowlist profile fallbacks from target-board seed.
 * On3-synced recruiting store fields win for position (see allowlist-target-sync).
 * Board JSON is used only when On3 has not populated pos yet.
 */
const fs = require('fs');
const path = require('path');
const { isPlaceholderSchool } = require('./recruiting-placeholder-school');
const { ALLOWLIST_2028 } = require('./recruiting-target-allowlist');

/** @deprecated Use ALLOWLIST_2028 + board file — kept for listEditorial2028YoungerProspects(). */
const EDITORIAL_2028_YOUNGER_PROSPECTS = new Set([
  'andre-alexander',
  'tristin-gaines',
  'izayah-vickers',
  'braxton-rein',
  'jordon-gorham',
  'anthony-howard-jr',
  'pj-evans',
  'kahmaree-crumity',
  'quinton-rolle-jr',
  'tristian-henderson',
  'bryce-willingham',
  'john-matthews',
  'armani-strong',
  'bubba-brown',
  'dominick-harris-payne',
  'gabriel-player',
  'prince-che',
  'brady-quinn',
  'malakhi-dudley',
]);

const TARGET_BOARD_PATH = path.join(__dirname, '..', 'data', 'recruiting', '2028-target-board.json');

let cachedMap = null;
let cachedMtime = 0;

function loadBoardFile() {
  try {
    const stat = fs.statSync(TARGET_BOARD_PATH);
    if (cachedMap && stat.mtimeMs === cachedMtime) return cachedMap;
    const board = JSON.parse(fs.readFileSync(TARGET_BOARD_PATH, 'utf8'));
    const map = new Map();
    for (const row of board.targets || []) {
      const slug = String(row.slug || '').toLowerCase();
      if (!slug || !ALLOWLIST_2028.includes(slug)) continue;
      map.set(slug, {
        slug,
        pos: row.pos ? String(row.pos).trim().toUpperCase() : null,
        stars: row.stars != null ? Number(row.stars) : null,
        classYear: 2028,
        school: row.school ? String(row.school).trim() : null,
        state: row.state ? String(row.state).trim().toUpperCase() : null,
        natlRank: row.natlRank != null ? Number(row.natlRank) : null,
        posRank: row.posRank != null ? Number(row.posRank) : null,
        stateRank: row.stateRank != null ? Number(row.stateRank) : null,
        rating: row.rating != null ? Number(row.rating) : null,
        inState: row.inState != null ? Boolean(row.inState) : null,
      });
    }
    cachedMap = map;
    cachedMtime = stat.mtimeMs;
    return map;
  } catch {
    cachedMap = new Map();
    cachedMtime = 0;
    return cachedMap;
  }
}

function isEditorialPositionSlug(slug, classYear = 2028) {
  const s = String(slug || '').toLowerCase();
  return Number(classYear) === 2028 && ALLOWLIST_2028.includes(s);
}

function getEditorialPosition(slug, classYear = 2028) {
  const s = String(slug || '').toLowerCase();
  if (!isEditorialPositionSlug(s, classYear)) return null;
  return loadBoardFile().get(s) || null;
}

function applyEditorialPositionToPlayer(player) {
  if (!player) return player;
  const editorial = getEditorialPosition(player.slug, player.classYear ?? player.class_year);
  if (!editorial?.pos) return player;
  const out = { ...player };
  if (editorial.pos && !out.pos) {
    out.pos = editorial.pos;
    out.position = editorial.pos;
  }
  if (editorial.stars != null && Number.isFinite(editorial.stars)) {
    out.stars = editorial.stars;
  }
  if (editorial.school && !isPlaceholderSchool(editorial.school)) out.school = editorial.school;
  if (editorial.state) {
    out.state = editorial.state;
    out.hometownState = editorial.state;
  }
  if (editorial.natlRank != null && Number.isFinite(editorial.natlRank)) {
    out.natlRank = editorial.natlRank;
  }
  if (editorial.posRank != null && Number.isFinite(editorial.posRank)) {
    out.posRank = editorial.posRank;
  }
  if (editorial.stateRank != null && Number.isFinite(editorial.stateRank)) {
    out.stateRank = editorial.stateRank;
  }
  if (editorial.rating != null && Number.isFinite(editorial.rating)) {
    out.rating = editorial.rating;
    out.displayRating = editorial.rating;
  }
  if (editorial.inState != null) out.inState = editorial.inState;
  return out;
}

/** FutureCast board position — On3/recruiting store first; board seed is fallback only. */
function resolveFutureCastPosition({ slug, classYear, recruiting, seed, rank, model }) {
  const storePos = String(
    recruiting?.pos ||
      recruiting?.position ||
      rank?.position ||
      seed?.pos ||
      seed?.position ||
      model?.position ||
      ''
  )
    .trim()
    .toUpperCase();
  if (storePos) return storePos;
  const editorial = getEditorialPosition(slug, classYear);
  return editorial?.pos || '';
}

function listEditorial2028YoungerProspects() {
  const map = loadBoardFile();
  return [...EDITORIAL_2028_YOUNGER_PROSPECTS].map((slug) => {
    const row = map.get(slug);
    return row || { slug, pos: null, stars: null, classYear: 2028 };
  });
}

module.exports = {
  EDITORIAL_2028_YOUNGER_PROSPECTS,
  TARGET_BOARD_PATH,
  isEditorialPositionSlug,
  getEditorialPosition,
  applyEditorialPositionToPlayer,
  resolveFutureCastPosition,
  listEditorial2028YoungerProspects,
  loadBoardFile,
};
