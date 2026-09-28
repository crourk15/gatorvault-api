/**
 * Film Room video cache — repo seed + durable overlay on Render disk.
 * Also persists catalog rebuild freshness so Admin Hub Film Room stays green
 * across Render sleep/restarts (ops heartbeats alone are not enough).
 */
const fs = require('fs');
const path = require('path');

const REPO_CACHE_PATH = path.join(__dirname, '..', 'data', 'film-room', 'cache.json');
const REPO_CATALOG_STAMP_PATH = path.join(__dirname, '..', 'data', 'film-room', 'catalog.json');

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

function resolveCatalogStampPath() {
  if (process.env.FILM_ROOM_CATALOG_PATH) return String(process.env.FILM_ROOM_CATALOG_PATH).trim();
  const root = durableRoot();
  if (root) return path.join(root, 'catalog.json');
  return REPO_CATALOG_STAMP_PATH;
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function normalizeAuto(auto) {
  const a = auto && typeof auto === 'object' ? auto : {};
  return {
    gnfp: Array.isArray(a.gnfp) ? a.gnfp : [],
    pressers: Array.isArray(a.pressers) ? a.pressers : [],
    highlights: Array.isArray(a.highlights) ? a.highlights : [],
    filmGuy: Array.isArray(a.filmGuy) ? a.filmGuy : [],
    tengwall: Array.isArray(a.tengwall) ? a.tengwall : [],
  };
}

function emptyCache() {
  return { auto: normalizeAuto({}), meta: { version: 1 } };
}

const AUTO_BUCKETS = ['gnfp', 'pressers', 'highlights', 'filmGuy', 'tengwall'];

function youtubeKey(row) {
  return String(row?.youtubeId || '').trim() || String(row?.id || '').trim();
}

/**
 * Render durable cache wins on disk, but a stale file can hide videos that
 * already landed in git (manual ingest / cron miss after deploy). Union repo
 * youtubeIds into durable so Film Room catalog can show them before the next
 * YouTube sync.
 */
function mergeRepoIntoDurable(durable, repo) {
  const out = {
    ...(durable && typeof durable === 'object' ? durable : {}),
    auto: normalizeAuto(durable?.auto),
    meta: { ...((durable && durable.meta) || {}) },
  };
  let added = 0;
  for (const bucket of AUTO_BUCKETS) {
    const durableRows = Array.isArray(out.auto[bucket]) ? out.auto[bucket] : [];
    const repoRows = Array.isArray(repo?.auto?.[bucket]) ? repo.auto[bucket] : [];
    const seen = new Set(durableRows.map(youtubeKey).filter(Boolean));
    const extra = [];
    for (const row of repoRows) {
      const key = youtubeKey(row);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      extra.push(row);
      added += 1;
    }
    if (!extra.length) continue;
    const merged = durableRows.concat(extra);
    merged.sort((a, b) => {
      const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return tb - ta;
    });
    out.auto[bucket] = merged;
  }
  if (added > 0) {
    out.meta = {
      ...out.meta,
      version: 1,
      repoHealAdded: added,
      repoHealedAt: new Date().toISOString(),
    };
  }
  return { cache: out, added };
}

function loadFilmRoomCache() {
  const seeded = readJson(REPO_CACHE_PATH, emptyCache());
  seeded.auto = normalizeAuto(seeded.auto);

  const target = resolveCachePath();
  if (target === REPO_CACHE_PATH || !fs.existsSync(target)) {
    return seeded;
  }

  const durable = readJson(target, null);
  if (!durable || !durable.auto) {
    return seeded;
  }

  durable.auto = normalizeAuto(durable.auto);
  const { cache, added } = mergeRepoIntoDurable(durable, seeded);
  if (added > 0) {
    try {
      saveFilmRoomCache(cache);
    } catch {
      // Serve the union even if the durable write fails.
    }
  }
  return cache;
}

function saveFilmRoomCache(cache) {
  const target = resolveCachePath();
  const dir = path.dirname(target);
  fs.mkdirSync(dir, { recursive: true });
  const updatedAt = new Date().toISOString();
  const payload = {
    ...cache,
    updatedAt,
    auto: normalizeAuto(cache?.auto),
    meta: {
      ...(cache.meta || {}),
      version: 1,
      updatedAt,
      path: target,
    },
  };
  fs.writeFileSync(target, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return { path: target, durable: target !== REPO_CACHE_PATH };
}

/**
 * Load last catalog rebuild stamp (durable disk first, then repo path).
 * Shape: { updatedAt, rebuiltAt?, counts?, mode?, path? }
 */
function loadCatalogStamp() {
  const durablePath = resolveCatalogStampPath();
  if (durablePath !== REPO_CATALOG_STAMP_PATH && fs.existsSync(durablePath)) {
    const durable = readJson(durablePath, null);
    if (durable && durable.updatedAt) return durable;
  }
  const seeded = readJson(REPO_CATALOG_STAMP_PATH, null);
  if (seeded && seeded.updatedAt) return seeded;
  return null;
}

/**
 * Persist catalog rebuild freshness to durable disk (when present) and repo path
 * so ops-status can read either after a cold start.
 */
function saveCatalogStamp(stamp) {
  const updatedAt = stamp?.updatedAt || new Date().toISOString();
  const payload = {
    ok: true,
    updatedAt,
    rebuiltAt: stamp?.rebuiltAt || updatedAt,
    counts: stamp?.counts || null,
    mode: stamp?.mode || 'merged',
    source: 'film-room-rebuild',
  };

  const durablePath = resolveCatalogStampPath();
  const targets = [durablePath];
  // Mirror into repo path on real durable disk (/var/data). Skip when FILM_ROOM_DATA_DIR
  // is overridden (tests) so we do not dirty committed seed data.
  if (
    durablePath !== REPO_CATALOG_STAMP_PATH
    && !process.env.FILM_ROOM_DATA_DIR
  ) {
    targets.push(REPO_CATALOG_STAMP_PATH);
  }

  const written = [];
  for (const target of targets) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const body = { ...payload, path: target };
    fs.writeFileSync(target, JSON.stringify(body, null, 2) + '\n', 'utf8');
    written.push(target);
  }

  return {
    updatedAt,
    paths: written,
    durable: durablePath !== REPO_CATALOG_STAMP_PATH,
  };
}

module.exports = {
  REPO_CACHE_PATH,
  REPO_CATALOG_STAMP_PATH,
  durableRoot,
  resolveCachePath,
  resolveCatalogStampPath,
  loadFilmRoomCache,
  saveFilmRoomCache,
  mergeRepoIntoDurable,
  loadCatalogStamp,
  saveCatalogStamp,
};
