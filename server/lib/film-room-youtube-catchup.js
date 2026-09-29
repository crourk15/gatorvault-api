/**
 * Film Room YouTube catch-up — do not wait on the 3-hour cron.
 *
 * Keepalive already hits GET /api/film-room/catalog. When the last RSS sync
 * is stale, kick a background RSS-only ingest (no YouTube search) so a
 * same-day GNFP / presser lands without an agent commit.
 */
'use strict';

const { loadFilmRoomCache } = require('./film-room-cache-store');

const DEFAULT_STALE_MS = 15 * 60 * 1000;

function catchUpStaleMs() {
  const raw = String(process.env.FILM_ROOM_CATCHUP_STALE_MS || '').trim();
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_STALE_MS;
}

function catchUpEnabled() {
  if (process.env.FILM_ROOM_CATCHUP === 'false') return false;
  if (process.env.FILM_ROOM_CATCHUP === 'true') return true;
  return process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
}

function lastYoutubeSyncMs(cache) {
  const raw =
    cache && cache.meta && cache.meta.youtubeSyncedAt
      ? cache.meta.youtubeSyncedAt
      : cache && cache.updatedAt
        ? cache.updatedAt
        : null;
  const ms = raw ? Date.parse(raw) : 0;
  return Number.isFinite(ms) ? ms : 0;
}

function shouldCatchUp(cache, now = Date.now()) {
  return now - lastYoutubeSyncMs(cache) >= catchUpStaleMs();
}

let inflight = null;

async function runCatchUp() {
  const { syncFilmRoomYouTube } = require('./film-room-youtube-ingest');
  return syncFilmRoomYouTube({ skipSearch: true });
}

function scheduleFilmRoomYoutubeCatchUp() {
  if (!catchUpEnabled()) return { scheduled: false, reason: 'disabled' };
  let cache;
  try {
    cache = loadFilmRoomCache();
  } catch {
    return { scheduled: false, reason: 'cache_load_failed' };
  }
  if (!shouldCatchUp(cache)) return { scheduled: false, reason: 'fresh' };
  if (inflight) return { scheduled: false, reason: 'inflight' };
  inflight = runCatchUp()
    .catch((err) => {
      console.warn('[film-room] youtube catch-up failed:', err && err.message ? err.message : err);
      return { ok: false, error: err && err.message ? err.message : String(err) };
    })
    .finally(() => {
      inflight = null;
    });
  return { scheduled: true };
}

function resetCatchUpForTests() {
  inflight = null;
}

module.exports = {
  DEFAULT_STALE_MS,
  catchUpEnabled,
  catchUpStaleMs,
  lastYoutubeSyncMs,
  shouldCatchUp,
  scheduleFilmRoomYoutubeCatchUp,
  resetCatchUpForTests,
};
