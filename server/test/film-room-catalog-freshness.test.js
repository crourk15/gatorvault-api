/**
 * Film Room rebuild must persist a durable catalog stamp so Admin Hub
 * Film Room / Beat Desk / FutureCast do not bounce red after Render sleep.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('Film Room durable catalog freshness', () => {
  let tmpDir;
  let prevDataDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-film-stamp-'));
    prevDataDir = process.env.FILM_ROOM_DATA_DIR;
    process.env.FILM_ROOM_DATA_DIR = tmpDir;
    // Clear module cache so durableRoot picks up the env override.
    delete require.cache[require.resolve('../lib/film-room-cache-store')];
    delete require.cache[require.resolve('../lib/film-room-feed')];
  });

  after(() => {
    if (prevDataDir == null) delete process.env.FILM_ROOM_DATA_DIR;
    else process.env.FILM_ROOM_DATA_DIR = prevDataDir;
    delete require.cache[require.resolve('../lib/film-room-cache-store')];
    delete require.cache[require.resolve('../lib/film-room-feed')];
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('saveCatalogStamp writes durable updatedAt and loadCatalogStamp reads it back', () => {
    const store = require('../lib/film-room-cache-store');
    const now = '2026-07-29T13:00:00.000Z';
    const saved = store.saveCatalogStamp({
      updatedAt: now,
      rebuiltAt: now,
      counts: { total: 3 },
      mode: 'merged',
    });
    assert.equal(saved.updatedAt, now);
    assert.equal(saved.durable, true);
    assert.ok(fs.existsSync(path.join(tmpDir, 'catalog.json')));

    const loaded = store.loadCatalogStamp();
    assert.ok(loaded);
    assert.equal(loaded.updatedAt, now);
    assert.equal(loaded.source, 'film-room-rebuild');
  });

  it('rebuildFilmRoomCatalog stamps a fresh updatedAt (not June knowledge manifest)', () => {
    const feed = require('../lib/film-room-feed');
    const before = Date.now();
    const catalog = feed.rebuildFilmRoomCatalog();
    const after = Date.now();

    assert.ok(catalog);
    assert.ok(catalog.updatedAt);
    const ms = new Date(catalog.updatedAt).getTime();
    assert.ok(Number.isFinite(ms));
    assert.ok(ms >= before - 1000);
    assert.ok(ms <= after + 1000);

    // Knowledge content age may still be old — rebuild stamp must win.
    if (catalog.knowledgeUpdatedAt) {
      const knowledgeMs = new Date(catalog.knowledgeUpdatedAt).getTime();
      if (Number.isFinite(knowledgeMs) && knowledgeMs < before - 86400000) {
        assert.ok(ms > knowledgeMs);
      }
    }

    const store = require('../lib/film-room-cache-store');
    const stamp = store.loadCatalogStamp();
    assert.equal(stamp.updatedAt, catalog.updatedAt);
  });

  it('stamped rebuild is fresh enough for Film Room ops green (8-day threshold)', () => {
    const feed = require('../lib/film-room-feed');
    feed.rebuildFilmRoomCatalog();
    const store = require('../lib/film-room-cache-store');
    const stamp = store.loadCatalogStamp();
    assert.ok(stamp?.updatedAt);

    // Mirrors server/lib/ops-status.js freshnessStatus thresholds for film-room.
    const warningHours = 8 * 24;
    const criticalHours = 8 * 36;
    const hours = Math.round((Date.now() - new Date(stamp.updatedAt).getTime()) / 3600000);
    let status = 'red';
    if (hours <= warningHours) status = 'green';
    else if (hours <= criticalHours) status = 'yellow';
    assert.equal(status, 'green', `stamp age ${hours}h should be green`);
  });
});
