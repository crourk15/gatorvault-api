/**
 * Soft background YouTube ingest when Film Room cache is stale.
 * Catalog GET stays fast — sync runs after the response is sent.
 */
const { loadFilmRoomCache } = require('./film-room-cache-store');

let syncInFlight = false;
let lastAttemptAt = 0;

function softSyncMaxAgeMs() {
  const raw = parseInt(process.env.FILM_ROOM_SOFT_SYNC_MAX_AGE_MS || '', 10);
  if (Number.isFinite(raw) && raw > 0) return raw;
  // Camp season: refresh within ~1h if someone opens Film Room between crons.
  return 60 * 60 * 1000;
}

function softSyncCooldownMs() {
  const raw = parseInt(process.env.FILM_ROOM_SOFT_SYNC_COOLDOWN_MS || '', 10);
  if (Number.isFinite(raw) && raw > 0) return raw;
  return 10 * 60 * 1000;
}

function cacheAgeMs(cache) {
  const stamp = cache?.meta?.updatedAt || cache?.meta?.syncedAt || null;
  if (!stamp) return Number.POSITIVE_INFINITY;
  const ms = new Date(stamp).getTime();
  if (!Number.isFinite(ms)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Date.now() - ms);
}

/**
 * Fire-and-forget YouTube sync when presser cache is older than the soft-sync max age.
 * Safe to call on every catalog GET — debounced + stay-green aware.
 */
function maybeSoftSyncFilmRoomYouTube(opts = {}) {
  if (process.env.FILM_ROOM_SOFT_SYNC_ENABLED === 'false') {
    return { skipped: true, reason: 'disabled' };
  }
  if (syncInFlight) {
    return { skipped: true, reason: 'sync_in_progress' };
  }

  const now = Date.now();
  if (!opts.force && now - lastAttemptAt < softSyncCooldownMs()) {
    return { skipped: true, reason: 'cooldown' };
  }

  let ageMs = Number.POSITIVE_INFINITY;
  try {
    ageMs = cacheAgeMs(loadFilmRoomCache());
  } catch {
    ageMs = Number.POSITIVE_INFINITY;
  }
  if (!opts.force && ageMs < softSyncMaxAgeMs()) {
    return { skipped: true, reason: 'fresh', ageMs };
  }

  const { stayGreenSkipPayload } = require('./api-stay-green');
  const skipped = stayGreenSkipPayload('film-room-youtube-sync');
  if (skipped) {
    return { skipped: true, reason: 'stay_green' };
  }

  syncInFlight = true;
  lastAttemptAt = now;

  setImmediate(() => {
    Promise.resolve()
      .then(async () => {
        const { syncFilmRoomYouTube } = require('./film-room-youtube-ingest');
        const filmRoom = require('./film-room-feed');
        const sync = await syncFilmRoomYouTube();
        filmRoom.rebuildFilmRoomCatalog();
        console.log(
          '[film-room] soft youtube sync complete',
          JSON.stringify({
            added: sync?.added ?? null,
            pressers: sync?.counts?.pressers ?? null,
          })
        );
      })
      .catch((err) => {
        console.warn('[film-room] soft youtube sync failed:', err?.message || err);
      })
      .finally(() => {
        syncInFlight = false;
      });
  });

  return { started: true, ageMs };
}

function __resetSoftSyncStateForTests() {
  syncInFlight = false;
  lastAttemptAt = 0;
}

module.exports = {
  maybeSoftSyncFilmRoomYouTube,
  softSyncMaxAgeMs,
  softSyncCooldownMs,
  cacheAgeMs,
  __resetSoftSyncStateForTests,
};
