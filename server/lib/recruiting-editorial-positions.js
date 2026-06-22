/**
 * Editorial position overrides for locked underclassmen (Younger Prospects board).
 * Source of truth: server/data/recruiting/2028-target-board.json for listed slugs.
 */
const fs = require('fs');
const path = require('path');

/** Younger Prospects — Charles' corrected 2028 positions (18 slugs). */
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
      if (!slug || !EDITORIAL_2028_YOUNGER_PROSPECTS.has(slug)) continue;
      map.set(slug, {
        slug,
        pos: row.pos ? String(row.pos).trim().toUpperCase() : null,
        stars: row.stars != null ? Number(row.stars) : null,
        classYear: 2028,
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
  return Number(classYear) === 2028 && EDITORIAL_2028_YOUNGER_PROSPECTS.has(s);
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
  out.pos = editorial.pos;
  if (editorial.stars != null && Number.isFinite(editorial.stars)) {
    out.stars = editorial.stars;
  }
  return out;
}

/** FutureCast board position — editorial JSON wins for locked 2028 younger prospects. */
function resolveFutureCastPosition({ slug, classYear, recruiting, seed, rank, model }) {
  const editorial = getEditorialPosition(slug, classYear);
  if (editorial?.pos) return editorial.pos;
  return String(
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
