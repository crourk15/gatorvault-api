'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

describe('Film Room YouTube catch-up', () => {
  const prev = {
    FILM_ROOM_CATCHUP: process.env.FILM_ROOM_CATCHUP,
    FILM_ROOM_CATCHUP_STALE_MS: process.env.FILM_ROOM_CATCHUP_STALE_MS,
    NODE_ENV: process.env.NODE_ENV,
    RENDER: process.env.RENDER,
  };

  afterEach(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    delete require.cache[require.resolve('../lib/film-room-youtube-catchup')];
  });

  function load() {
    delete require.cache[require.resolve('../lib/film-room-youtube-catchup')];
    return require('../lib/film-room-youtube-catchup');
  }

  it('is off in unit tests unless FILM_ROOM_CATCHUP=true', () => {
    delete process.env.FILM_ROOM_CATCHUP;
    delete process.env.RENDER;
    process.env.NODE_ENV = 'test';
    const mod = load();
    assert.equal(mod.catchUpEnabled(), false);
    assert.deepEqual(mod.scheduleFilmRoomYoutubeCatchUp(), { scheduled: false, reason: 'disabled' });
  });

  it('treats a cache synced 20 minutes ago as stale', () => {
    process.env.FILM_ROOM_CATCHUP = 'true';
    const mod = load();
    const now = Date.parse('2026-09-29T17:20:00.000Z');
    assert.equal(
      mod.shouldCatchUp(
        { meta: { youtubeSyncedAt: '2026-09-29T17:00:00.000Z' } },
        now
      ),
      true
    );
    assert.equal(
      mod.shouldCatchUp(
        { meta: { youtubeSyncedAt: '2026-09-29T17:10:00.000Z' } },
        now
      ),
      false
    );
  });

  it('catalog route schedules catch-up and cron is hourly', () => {
    const routes = fs.readFileSync(path.join(__dirname, '../lib/platform-routes.js'), 'utf8');
    const yaml = fs.readFileSync(path.join(__dirname, '../../render.yaml'), 'utf8');
    assert.match(routes, /scheduleFilmRoomYoutubeCatchUp/);
    assert.match(yaml, /gatorvault-api-film-room-youtube-sync/);
    assert.match(yaml, /45 \* \* \* \*/);
  });
});
