'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('path');

describe('Tier B hub GET no-sync + durable snapshots', () => {
  let tmp;
  let prevDataDir;
  let prevNoSync;

  before(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-hub-runtime-'));
    prevDataDir = process.env.GV_RECRUITING_DATA_DIR;
    prevNoSync = process.env.HUB_GET_NO_SYNC_BUILD;
    process.env.GV_RECRUITING_DATA_DIR = tmp;
    process.env.HUB_GET_NO_SYNC_BUILD = 'true';
    // Fresh module so env + data dir stick.
    delete require.cache[require.resolve('../../lib/recruiting-hub-cache')];
    delete require.cache[require.resolve('../../lib/recruiting-data-dir')];
  });

  after(() => {
    if (prevDataDir == null) delete process.env.GV_RECRUITING_DATA_DIR;
    else process.env.GV_RECRUITING_DATA_DIR = prevDataDir;
    if (prevNoSync == null) delete process.env.HUB_GET_NO_SYNC_BUILD;
    else process.env.HUB_GET_NO_SYNC_BUILD = prevNoSync;
    delete require.cache[require.resolve('../../lib/recruiting-hub-cache')];
    delete require.cache[require.resolve('../../lib/recruiting-data-dir')];
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('memory-cache deferMiss returns without awaiting rebuild', async () => {
    const { createMemoryCache } = require('../../lib/memory-cache');
    const cache = createMemoryCache(60_000);
    let built = false;
    const result = await cache.wrap(
      'k1',
      async () => {
        await new Promise((r) => setTimeout(r, 80));
        built = true;
        return { ok: 1 };
      },
      60_000,
      { deferMiss: true }
    );
    assert.equal(result.deferred, true);
    assert.equal(built, false);
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(built, false);
    assert.equal(cache.get('k1'), null);
  });

  it('serveCached never awaits or starts per-key builder on cold miss', async () => {
    process.env.HUB_GET_NO_SYNC_BUILD = 'true';
    process.env.HUB_ASYNC_WARM_DEBOUNCE_MS = '600000';
    delete require.cache[require.resolve('../../lib/recruiting-hub-cache')];
    const {
      serveCached,
      clearHubCache,
      hubCache,
      hubGetNoSyncBuild,
    } = require('../../lib/recruiting-hub-cache');
    assert.equal(hubGetNoSyncBuild(), true);
    clearHubCache();
    hubCache.remove('tier-b-hang');
    let started = false;
    const result = await serveCached(
      'tier-b-hang',
      async () => {
        started = true;
        return { ok: true };
      },
      { timeoutMs: 30_000 }
    );
    assert.equal(result.status, 'building');
    assert.equal(result.reason, 'deferred_rebuild');
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(started, false);
  });

  it('serveCached returns durable disk snapshot without rebuild', async () => {
    const {
      serveCached,
      clearHubCache,
      writeHubDiskSnapshot,
      hubCache,
    } = require('../../lib/recruiting-hub-cache');
    clearHubCache();
    const payload = {
      year: 2028,
      title: 'Florida Recruiting',
      ticker: [{ id: 1 }],
    };
    assert.equal(writeHubDiskSnapshot('hero', 2028, payload), true);
    hubCache.remove('hub:elite:hero:2028');
    let built = false;
    const result = await serveCached(
      'hub:elite:hero:2028',
      async () => {
        built = true;
        return payload;
      },
      { diskFallback: { endpoint: 'hero', year: 2028 } }
    );
    assert.equal(result.status, 'ready');
    assert.equal(result.diskSnapshot, true);
    assert.equal(result.value.year, 2028);
    assert.equal(built, false);
  });

  it('secondary warm jobs use commits:v3 cache key', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib', 'recruiting-hub-cache.js'),
      'utf8'
    );
    assert.match(src, /hub:elite:commits:v3:\$\{year\}/);
    assert.doesNotMatch(src, /hub:elite:commits:\$\{year\}/);
  });

  it('FutureCast Lab GET deferMiss is default-on', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'api', 'futurecast', 'response-cache.ts'),
      'utf8'
    );
    assert.match(src, /FC_GET_NO_SYNC_BUILD !== 'false'/);
    assert.match(src, /deferMiss/);
    assert.match(src, /deferred_rebuild/);
  });

  it('warm-memory + lab-warm routes and cron exist', () => {
    const routes = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib', 'recruiting-hub-routes.js'),
      'utf8'
    );
    assert.match(routes, /\/api\/recruiting\/hub\/warm-memory/);
    const mount = fs.readFileSync(
      path.join(__dirname, '..', '..', 'api', 'futurecast', 'mount.ts'),
      'utf8'
    );
    assert.match(mount, /\/api\/futurecast\/lab-warm/);
    const cron = fs.readFileSync(
      path.join(__dirname, '..', '..', 'scripts', 'render-hub-warm-cron.js'),
      'utf8'
    );
    assert.match(cron, /warm-memory/);
    assert.match(cron, /lab-warm/);
    const yaml = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'render.yaml'), 'utf8');
    assert.match(yaml, /gatorvault-api-hub-warm/);
    assert.match(yaml, /warmAfter=priority/);
  });
});
