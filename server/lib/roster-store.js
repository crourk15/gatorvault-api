const fs = require('fs');
const path = require('path');
const { slugify } = require('./slug');

const DATA_DIR = path.join(__dirname, '..', 'data', 'roster');
const PLAYERS_PATH = path.join(DATA_DIR, 'players.json');

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
    stars: raw.stars != null ? raw.stars : null,
    rank: raw.rank != null ? raw.rank : null,
    rating: raw.rating != null ? Number(raw.rating) : null,
    ratingOverride: raw.ratingOverride != null ? Number(raw.ratingOverride) : null,
    headshotUrl: raw.headshotUrl || null,
    bio: raw.bio || '',
    stats: raw.stats || '',
    injury: raw.injury || 'green',
    updatedAt: raw.updatedAt || nowIso()
  };
  player.displayRating = displayRating(player);
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

module.exports = {
  DATA_DIR,
  PLAYERS_PATH,
  displayRating,
  normalizeRosterPlayer,
  getAllRosterPlayers,
  getRosterPlayerBySlug,
  upsertRosterPlayer,
  loadPlayers
};
