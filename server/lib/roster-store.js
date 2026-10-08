const fs = require('fs');
const path = require('path');
const { slugify } = require('./slug');
const { resolveRosterPositionGroup } = require('./roster-position-groups');

const DATA_DIR = path.join(__dirname, '..', 'data', 'roster');
const PLAYERS_PATH = path.join(DATA_DIR, 'players.json');
const HEADSHOTS_MAP_PATH = path.join(DATA_DIR, 'headshots.json');
const HEADSHOTS_DIR = path.join(__dirname, '..', 'headshots');
const RENDER_PRODUCTION_PATH = '/var/data/roster/production-stats.json';

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

const TRUSTED_PRODUCTION_SOURCES = new Set(['cfbd', 'official']);

function normalizeProductionStats(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const source = TRUSTED_PRODUCTION_SOURCES.has(raw.source) ? raw.source : null;
  if (!source) return null;
  if (!Array.isArray(raw.seasons) && !Array.isArray(raw.recentGames)) return null;
  const seasons = Array.isArray(raw.seasons) ? raw.seasons : [];
  const recentGames = Array.isArray(raw.recentGames) ? raw.recentGames : [];
  if (!seasons.length && !recentGames.length) return null;
  return {
    source,
    syncedAt: raw.syncedAt || null,
    cfbdPlayerId:
      raw.cfbdPlayerId != null && Number.isFinite(Number(raw.cfbdPlayerId))
        ? Number(raw.cfbdPlayerId)
        : null,
    matchConfidence: raw.matchConfidence === 'exact' || raw.matchConfidence === 'high' ? raw.matchConfidence : null,
    seasons,
    recentGames,
  };
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
    cfbdPlayerId: raw.cfbdPlayerId != null && Number.isFinite(Number(raw.cfbdPlayerId)) ? Number(raw.cfbdPlayerId) : null,
    productionStats: normalizeProductionStats(raw.productionStats),
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
  const pos = String(player.pos || player.position || '').toUpperCase();
  const storedGroup = raw.positionGroup || raw.group;
  player.positionGroup = resolveRosterPositionGroup(pos, storedGroup);
  return player;
}

function resolveProductionOverlayPath() {
  const fromEnv = String(process.env.GV_ROSTER_PRODUCTION_PATH || '').trim();
  if (fromEnv) return fromEnv;
  try {
    if (process.env.NODE_ENV === 'production' && fs.existsSync('/var/data')) {
      return RENDER_PRODUCTION_PATH;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function maxProductionWeek(ps) {
  const games = Array.isArray(ps?.recentGames) ? ps.recentGames : [];
  return games.reduce((n, g) => Math.max(n, Number(g.week) || 0), 0);
}

function preferProduction(fromGit, fromOverlay) {
  if (!fromOverlay) return fromGit || null;
  if (!fromGit) return fromOverlay;
  if (maxProductionWeek(fromOverlay) > maxProductionWeek(fromGit)) return fromOverlay;
  const overlayAt = Date.parse(fromOverlay.syncedAt || '');
  const gitAt = Date.parse(fromGit.syncedAt || '');
  if (Number.isFinite(overlayAt) && (!Number.isFinite(gitAt) || overlayAt > gitAt)) return fromOverlay;
  return fromGit;
}

function readProductionOverlay() {
  const dest = resolveProductionOverlayPath();
  if (!dest) return { bySlug: {} };
  try {
    if (!fs.existsSync(dest)) return { bySlug: {} };
    const raw = JSON.parse(fs.readFileSync(dest, 'utf8'));
    if (!raw || typeof raw !== 'object' || !raw.bySlug || typeof raw.bySlug !== 'object') {
      return { bySlug: {} };
    }
    return raw;
  } catch {
    return { bySlug: {} };
  }
}

function writeProductionOverlay(bySlug) {
  const dest = resolveProductionOverlayPath();
  if (!dest) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ updatedAt: nowIso(), bySlug }));
  fs.renameSync(tmp, dest);
}

function applyOverlayToPlayers(players) {
  const bySlug = readProductionOverlay().bySlug || {};
  if (!Object.keys(bySlug).length) return players;
  return players.map((player) => {
    const slug = player.slug || slugify(player.name || '');
    const next = preferProduction(player.productionStats, bySlug[slug]);
    if (!next || next === player.productionStats) return player;
    return { ...player, productionStats: next };
  });
}

function loadPlayers() {
  return loadPlayersRaw().map(normalizeRosterPlayer);
}

function loadPlayersRaw() {
  return applyOverlayToPlayers(readJson(PLAYERS_PATH, []));
}

function applyProductionStatsUpdates(updatesBySlug) {
  const players = loadPlayersRaw();
  let changed = 0;
  const { slugify } = require('./slug');
  for (const player of players) {
    const slug = player.slug || slugify(player.name || '');
    if (!slug || !Object.prototype.hasOwnProperty.call(updatesBySlug, slug)) continue;
    const next = updatesBySlug[slug];
    if (next == null) {
      if (player.productionStats) {
        delete player.productionStats;
        player.updatedAt = nowIso();
        changed += 1;
      }
      continue;
    }
    player.productionStats = next;
    if (next.cfbdPlayerId != null) player.cfbdPlayerId = next.cfbdPlayerId;
    player.updatedAt = nowIso();
    changed += 1;
  }
  savePlayers(players);
  const overlayDest = resolveProductionOverlayPath();
  if (overlayDest) {
    const overlay = readProductionOverlay();
    const bySlug = { ...(overlay.bySlug || {}) };
    for (const [slug, next] of Object.entries(updatesBySlug)) {
      if (next == null) delete bySlug[slug];
      else bySlug[slug] = next;
    }
    writeProductionOverlay(bySlug);
  }
  try {
    require('./swing-impact').clearSwingProductionCache();
  } catch {
    /* optional — Game Week restamps from official box */
  }
  return { changed };
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
  try {
    require('./scouting-update-engine').queuePlayerScoutingRefresh(merged.slug, {
      reason: 'roster_player_update'
    });
  } catch {
    /* optional */
  }
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
  RENDER_PRODUCTION_PATH,
  resolveProductionOverlayPath,
  preferProduction,
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
  loadPlayersRaw,
  applyProductionStatsUpdates,
  normalizeProductionStats,
  TRUSTED_PRODUCTION_SOURCES,
  getHeadshotMap,
  updateHeadshotMapping
};
