/**
 * Dashboard cache must not sync-warm on the request path (Render health probe).
 * Run: node --test server/test/live-dashboard-cache-nonblocking.test.js
 */
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

describe('live-dashboard-cache request path', () => {
  const modPath = path.join(__dirname, '..', 'lib', 'live-dashboard-cache.js');
  let cache;

  beforeEach(() => {
    delete require.cache[require.resolve(modPath)];
    // Stub aggregator so a sync warm would be detectable if called.
    const aggPath = require.resolve('../lib/live-aggregator');
    delete require.cache[aggPath];
    require.cache[aggPath] = {
      id: aggPath,
      filename: aggPath,
      loaded: true,
      exports: {
        getDashboard: () => {
          const err = new Error('sync getDashboard must not run on request path');
          err.code = 'SYNC_WARM_FORBIDDEN';
          throw err;
        }
      }
    };
    cache = require(modPath);
    cache.clearDashboardCache();
  });

  afterEach(() => {
    delete require.cache[require.resolve(modPath)];
    delete require.cache[require.resolve('../lib/live-aggregator')];
  });

  it('returns warming fallback without sync warm', () => {
    const out = cache.getCachedDashboard({ feedLimit: 20 });
    assert.equal(out.ok, true);
    assert.equal(out.stale, true);
    assert.ok(Array.isArray(out.feed));
    assert.equal(out.feed.length, 0);
  });

  it('hub boot defaults defer immediate warm', () => {
    const hubSrc = require('fs').readFileSync(
      path.join(__dirname, '..', 'lib', 'recruiting-hub-cache.js'),
      'utf8'
    );
    assert.match(hubSrc, /HUB_BOOT_IMMEDIATE_WARM === 'true'/);
    assert.match(hubSrc, /HUB_BOOT_WARM_DELAY_MS \|\| '90000'/);
  });

  it('server defers heavy boot warm to >=60s by default', () => {
    const src = require('fs').readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    assert.match(src, /API_BOOT_DEFER_HEAVY_MS \|\| '180000'/);
    assert.match(src, /startPostBootHeavyServices/);
    assert.match(src, /PLAYER_INTEL_REFRESH_ON_BOOT === 'true'/);
    assert.match(src, /GUARDIAN_BOOT_DELAY_MS \|\| '20000'/);
    assert.match(src, /boot verify deferred/);
  });
});

describe('guardian boot must not block health', () => {
  it('defers guardian verify and caches wiring case map', () => {
    const src = require('fs').readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    assert.match(src, /boot verify deferred/);
    assert.match(src, /verifyBootAsync/);
    assert.match(src, /GUARDIAN_BOOT_DELAY_MS/);
    const wiring = require('fs').readFileSync(
      path.join(__dirname, '..', 'lib/guardian/platform-wiring.js'),
      'utf8'
    );
    assert.match(wiring, /_caseMapCache/);
    assert.match(wiring, /GUARDIAN_WIRING_DOUBLE_SIMULATE/);
  });
});
