/**
 * Film Room video cache — repo seed + durable overlay on Render disk.
 */
const fs = require('fs');
const path = require('path');

const REPO_CACHE_PATH = path.join(__dirname, '..', 'data', 'film-room', 'cache.json');

function durableRoot() {
  if (process.env.FILM_ROOM_DATA_DIR) return String(process.env.FILM_ROOM_DATA_DIR).trim();
  if (fs.existsSync('/var/data')) return '/var/data/film-room';
  return null;
}

function resolveCachePath() {
  if (process.env.FILM_ROOM_CACHE_PATH) return String(process.env.FILM_ROOM_CACHE_PATH).trim();
  const root = durableRoot();
  if (root) return path.join(root, 'cache.json');
  return REPO_CACHE_PATH;
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function emptyCache() {
  return { auto: { gnfp: [], pressers: [] }, meta: { version: 1 } };
}

function loadFilmRoomCache() {
  const target = resolveCachePath();
  if (target !== REPO_CACHE_PATH && fs.existsSync(target)) {
    const durable = readJson(target, null);
    if (durable && durable.auto) return durable;
  }
  const seeded = readJson(REPO_CACHE_PATH, emptyCache());
  if (!seeded.auto) seeded.auto = { gnfp: [], pressers: [] };
  if (!Array.isArray(seeded.auto.gnfp)) seeded.auto.gnfp = [];
  if (!Array.isArray(seeded.auto.pressers)) seeded.auto.pressers = [];
  return seeded;
}

function saveFilmRoomCache(cache) {
  const target = resolveCachePath();
  const dir = path.dirname(target);
  fs.mkdirSync(dir, { recursive: true });
  const payload = {
    ...cache,
    auto: {
      gnfp: Array.isArray(cache?.auto?.gnfp) ? cache.auto.gnfp : [],
      pressers: Array.isArray(cache?.auto?.pressers) ? cache.auto.pressers : [],
    },
    meta: {
      ...(cache.meta || {}),
      version: 1,
      updatedAt: new Date().toISOString(),
      path: target,
    },
  };
  fs.writeFileSync(target, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return { path: target, durable: target !== REPO_CACHE_PATH };
}

module.exports = {
  REPO_CACHE_PATH,
  durableRoot,
  resolveCachePath,
  loadFilmRoomCache,
  saveFilmRoomCache,
};
