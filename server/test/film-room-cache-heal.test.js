/**
 * Git Film Room cache must union into a stale Render durable file.
 * Cron miss after deploy left 9/28 Sumrall off the live catalog.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('Film Room repo-into-durable heal', () => {
  let tmpDir;
  let prevDataDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-film-heal-'));
    prevDataDir = process.env.FILM_ROOM_DATA_DIR;
    process.env.FILM_ROOM_DATA_DIR = tmpDir;
    delete require.cache[require.resolve('../lib/film-room-cache-store')];
  });

  after(() => {
    if (prevDataDir == null) delete process.env.FILM_ROOM_DATA_DIR;
    else process.env.FILM_ROOM_DATA_DIR = prevDataDir;
    delete require.cache[require.resolve('../lib/film-room-cache-store')];
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('adds repo-only youtubeIds when durable is stale', () => {
    const store = require('../lib/film-room-cache-store');
    fs.writeFileSync(
      path.join(tmpDir, 'cache.json'),
      JSON.stringify({
        auto: {
          pressers: [
            {
              id: 'yt_VVguTPt-Te8',
              title: 'Florida Football Postgame Press Conference | Coach Sumrall',
              youtubeId: 'VVguTPt-Te8',
              publishedAt: '2026-09-26T23:00:00.000Z',
            },
          ],
          gnfp: [],
          highlights: [],
          filmGuy: [],
          tengwall: [],
        },
        meta: { version: 1, stale: true },
      }, null, 2),
      'utf8'
    );

    const loaded = store.loadFilmRoomCache();
    const ids = (loaded.auto.pressers || []).map((row) => row.youtubeId);
    assert.ok(ids.includes('asXiHSFj7S8'), '9/28 Sumrall missing after heal');
    assert.ok(ids.includes('mCGBP7M7108'), '11/9 Monday Sumrall missing after heal');
    assert.ok(ids.includes('VVguTPt-Te8'), 'durable 9/26 postgame dropped');
    assert.ok((loaded.meta?.repoHealAdded || 0) >= 1);

    const persisted = JSON.parse(fs.readFileSync(path.join(tmpDir, 'cache.json'), 'utf8'));
    const persistedIds = (persisted.auto.pressers || []).map((row) => row.youtubeId);
    assert.ok(persistedIds.includes('asXiHSFj7S8'), 'heal did not write durable');
  });

  it('mergeRepoIntoDurable keeps durable rows and appends repo-only ids', () => {
    const store = require('../lib/film-room-cache-store');
    const { cache, added } = store.mergeRepoIntoDurable(
      {
        auto: {
          pressers: [{ id: 'yt_old', youtubeId: 'oldPresserxx', title: 'Old' }],
        },
      },
      {
        auto: {
          pressers: [
            { id: 'yt_old', youtubeId: 'oldPresserxx', title: 'Old from repo' },
            { id: 'yt_new', youtubeId: 'newPresserxx', title: 'New from repo' },
          ],
        },
      }
    );
    assert.equal(added, 1);
    const ids = cache.auto.pressers.map((row) => row.youtubeId);
    assert.deepEqual(ids.sort(), ['newPresserxx', 'oldPresserxx']);
    assert.equal(
      cache.auto.pressers.find((row) => row.youtubeId === 'oldPresserxx').title,
      'Old'
    );
  });
});
