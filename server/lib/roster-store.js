const fs = require('fs');
const path = require('path');
const { slugify } = require('./slug');

const DATA_DIR = path.join(__dirname, '..', 'data', 'roster');
const PLAYERS_PATH = path.join(DATA_DIR, 'players.json');
const HEADSHOTS_MAP_PATH = path.join(DATA_DIR, 'headshots.json');
const HEADSHOTS_DIR = path.join(__dirname, '..', 'headshots');

function readJson(filePath, fallback) {
  try {
    let text = fs.readFileSync(filePath, 'utf8');
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    return JSON.parse(text);
  } catch (e) {
    if (e.code !== 'ENOENT') {
      console.warn('[roster-store] readJson failed:', filePath, e.message);
    }
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function nowIso() {
  return new Date().toISOString();
}

function displayRating(player) {
  if (player.ratingOverride != null && player.ratingOverride !== '') {
    return Number(player.ratingOverride);
  }
  if (player.rating != null && player.rating !== '') return Number(player.rating);
  return null;
}

function loadHeadshotMap() {
  return readJson(HEADSHOTS_MAP_PATH, {});
}

function resolveHeadshotPath(url) {
  if (!url) return null;
  const s = String(url).trim();
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  if (s.startsWith('/')) return s;
  return `/headshots/${s}`;
}

function findLocalHeadshot(slug) {
  const exts = ['webp', 'jpg', 'jpeg', 'png', 'svg'];
  for (const ext of exts) {
    const filePath = path.join(HEADSHOTS_DIR, `${slug}.${ext}`);
    if (fs.existsSync(filePath)) return `/headshots/${slug}.${ext}`;
  }
  return null;
}

function resolveHeadshotUrl(player) {
  if (player.headshotUrl) return resolveHeadshotPath(player.headshotUrl);
  const map = loadHeadshotMap();
  if (map[player.slug]) return resolveHeadshotPath(map[player.slug]);
  return findLocalHeadshot(player.slug);
}

function normalizeRosterPlayer(raw) {
  const slug = raw.slug || slugify(raw.name);
  const player = {
    id: raw.id || slug,
    slug,
    name: raw.name,
    pos: raw.pos || raw.position || '',
    position: raw.position || raw.pos || '',
    year: raw.year || raw.class || '',
    class: raw.class || raw.year || '',
    height: raw.height || '',
    weight: raw.weight || '',
    hometown: raw.hometown || '',
    jersey: raw.jersey != null ? raw.jersey : null,
    unit: raw.unit || null,
    transferInfo: raw.transferInfo || raw.transferHistory || null,
    depthChartTier: raw.depthChartTier || null,
    stars: raw.stars != null ? raw.stars : null,
    rank: raw.rank != null ? raw.rank : null,
    rating: raw.rating != null ? Number(raw.rating) : null,
    ratingOverride: raw.ratingOverride != null ? Number(raw.ratingOverride) : null,
    vaultGradeExplanation: raw.vaultGradeExplanation || raw.gradeExplanation || '',
    vaultGradeUpdatedAt: raw.vaultGradeUpdatedAt || raw.gradeUpdatedAt || null,
    headshotUrl: raw.headshotUrl || null,
    bio: raw.bio || '',
    stats: raw.stats || '',
    injury: raw.injury || 'green',
    strengths: raw.strengths || null,
    weaknesses: raw.weaknesses || null,
    projection: raw.projection || null,
    schemeFit: raw.schemeFit || null,
    warRoomFeatured: !!(raw.warRoomFeatured ?? raw.war_room_featured),
    updatedAt: raw.updatedAt || nowIso()
  };
  if (!player.unit && player.pos) {
    const p = player.pos.toUpperCase();
    if (['QB', 'RB', 'WR', 'TE', 'OL'].includes(p)) player.unit = 'offense';
    else if (['P', 'K', 'LS'].includes(p)) player.unit = 'special';
    else player.unit = 'defense';
  }
  player.headshotUrl = resolveHeadshotUrl(player);
  player.hasHeadshot = !!player.headshotUrl;
  player.displayRating = displayRating(player);
  player.ratingIsOverride = player.ratingOverride != null && player.ratingOverride !== '';
  return player;
}

function loadPlayers() {
  return readJson(PLAYERS_PATH, []).map(normalizeRosterPlayer);
}

function savePlayers(players) {
  writeJson(PLAYERS_PATH, players);
}

function getAllRosterPlayers() {
  return loadPlayers().sort((a, b) => (b.displayRating || 0) - (a.displayRating || 0));
}

function getRosterPlayerBySlug(slug) {
  const p = loadPlayers().find((x) => x.slug === slug);
  return p ? normalizeRosterPlayer(p) : null;
}

function upsertRosterPlayer(patch) {
  const players = loadPlayers();
  const normalized = normalizeRosterPlayer(patch);
  if (!normalized.name) throw new Error('Player name required');
  const idx = players.findIndex((p) => p.slug === normalized.slug);
  const merged = idx >= 0
    ? normalizeRosterPlayer({ ...players[idx], ...patch, slug: normalized.slug, updatedAt: nowIso() })
    : { ...normalized, updatedAt: nowIso() };
  if (idx >= 0) players[idx] = merged;
  else players.push(merged);
  savePlayers(players);
  return merged;
}

function getHeadshotMap() {
  return loadHeadshotMap();
}

function updateHeadshotMapping(slug, url) {
  const map = loadHeadshotMap();
  if (url) map[slug] = resolveHeadshotPath(url);
  else delete map[slug];
  writeJson(HEADSHOTS_MAP_PATH, map);
  return map;
}

function setWarRoomFeatured(slug, featured = true) {
  const players = loadPlayers();
  const idx = players.findIndex((p) => p.slug === slug);
  if (idx < 0) return null;
  players[idx] = { ...players[idx], warRoomFeatured: !!featured, updatedAt: nowIso() };
  savePlayers(players);
  return normalizeRosterPlayer(players[idx]);
}

module.exports = {
  DATA_DIR,
  PLAYERS_PATH,
  HEADSHOTS_MAP_PATH,
  HEADSHOTS_DIR,
  displayRating,
  resolveHeadshotUrl,
  normalizeRosterPlayer,
  getAllRosterPlayers,
  getRosterPlayerBySlug,
  upsertRosterPlayer,
  setWarRoomFeatured,
  loadPlayers,
  getHeadshotMap,
  updateHeadshotMapping
};
