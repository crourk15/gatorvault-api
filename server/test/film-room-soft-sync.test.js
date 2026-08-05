/**
 * Soft YouTube sync should debounce and skip when the presser cache is fresh.
 */
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('Film Room soft YouTube sync', () => {
  let tmpDir;
  let prevDataDir;
  let prevSoftEnabled;
  let prevMaxAge;
  let prevCooldown;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-film-soft-'));
    prevDataDir = process.env.FILM_ROOM_DATA_DIR;
    prevSoftEnabled = process.env.FILM_ROOM_SOFT_SYNC_ENABLED;
    prevMaxAge = process.env.FILM_ROOM_SOFT_SYNC_MAX_AGE_MS;
    prevCooldown = process.env.FILM_ROOM_SOFT_SYNC_COOLDOWN_MS;
    process.env.FILM_ROOM_DATA_DIR = tmpDir;
    delete process.env.FILM_ROOM_SOFT_SYNC_ENABLED;
    process.env.FILM_ROOM_SOFT_SYNC_MAX_AGE_MS = '3600000';
    process.env.FILM_ROOM_SOFT_SYNC_COOLDOWN_MS = '600000';

    delete require.cache[require.resolve('../lib/film-room-cache-store')];
    delete require.cache[require.resolve('../lib/film-room-soft-sync')];
    delete require.cache[require.resolve('../lib/api-stay-green')];
  });

  afterEach(() => {
    if (prevDataDir == null) delete process.env.FILM_ROOM_DATA_DIR;
    else process.env.FILM_ROOM_DATA_DIR = prevDataDir;
    if (prevSoftEnabled == null) delete process.env.FILM_ROOM_SOFT_SYNC_ENABLED;
    else process.env.FILM_ROOM_SOFT_SYNC_ENABLED = prevSoftEnabled;
    if (prevMaxAge == null) delete process.env.FILM_ROOM_SOFT_SYNC_MAX_AGE_MS;
    else process.env.FILM_ROOM_SOFT_SYNC_MAX_AGE_MS = prevMaxAge;
    if (prevCooldown == null) delete process.env.FILM_ROOM_SOFT_SYNC_COOLDOWN_MS;
    else process.env.FILM_ROOM_SOFT_SYNC_COOLDOWN_MS = prevCooldown;

    delete require.cache[require.resolve('../lib/film-room-cache-store')];
    delete require.cache[require.resolve('../lib/film-room-soft-sync')];
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('skips when cache meta.updatedAt is fresh', () => {
    const store = require('../lib/film-room-cache-store');
    store.saveFilmRoomCache({
      auto: { gnfp: [], pressers: [{ id: 'x', title: 'Press', publishedAt: new Date().toISOString() }] },
      meta: { version: 1, updatedAt: new Date().toISOString() },
    });

    const soft = require('../lib/film-room-soft-sync');
    soft.__resetSoftSyncStateForTests();
    const out = soft.maybeSoftSyncFilmRoomYouTube();
    assert.equal(out.skipped, true);
    assert.equal(out.reason, 'fresh');
  });

  it('skips when soft sync is disabled', () => {
    process.env.FILM_ROOM_SOFT_SYNC_ENABLED = 'false';
    delete require.cache[require.resolve('../lib/film-room-soft-sync')];
    const soft = require('../lib/film-room-soft-sync');
    soft.__resetSoftSyncStateForTests();
    const out = soft.maybeSoftSyncFilmRoomYouTube({ force: true });
    assert.equal(out.skipped, true);
    assert.equal(out.reason, 'disabled');
  });

  it('starts when cache has no updatedAt (stale/missing)', () => {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'cache.json'),
      JSON.stringify({ auto: { gnfp: [], pressers: [] }, meta: { version: 1 } }),
      'utf8'
    );

    process.env.API_STAY_GREEN = 'false';

    const soft = require('../lib/film-room-soft-sync');
    soft.__resetSoftSyncStateForTests();

    const ingestPath = require.resolve('../lib/film-room-youtube-ingest');
    const feedPath = require.resolve('../lib/film-room-feed');
    const prevIngest = require.cache[ingestPath];
    const prevFeed = require.cache[feedPath];
    require.cache[ingestPath] = {
      id: ingestPath,
      filename: ingestPath,
      loaded: true,
      exports: {
        syncFilmRoomYouTube: async () => ({ added: 0, updated: 0, counts: { pressers: 0 } }),
      },
    };
    require.cache[feedPath] = {
      id: feedPath,
      filename: feedPath,
      loaded: true,
      exports: {
        rebuildFilmRoomCatalog: () => ({ ok: true }),
      },
    };

    try {
      const out = soft.maybeSoftSyncFilmRoomYouTube();
      assert.equal(out.started, true);
      const second = soft.maybeSoftSyncFilmRoomYouTube();
      assert.equal(second.skipped, true);
      assert.equal(second.reason, 'sync_in_progress');
    } finally {
      if (prevIngest) require.cache[ingestPath] = prevIngest;
      else delete require.cache[ingestPath];
      if (prevFeed) require.cache[feedPath] = prevFeed;
      else delete require.cache[feedPath];
      soft.__resetSoftSyncStateForTests();
    }
  });
});
