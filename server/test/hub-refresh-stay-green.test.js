'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

describe('hub refresh stay-green', () => {
  it('soft-refreshes by default (no unconditional cache wipe)', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'lib/recruiting-hub-refresh.js'), 'utf8');
    assert.match(src, /HUB_REFRESH_CLEAR_CACHES/);
    assert.match(src, /options\.clearCaches === true/);
    // clearHubCache must be gated — not called unconditionally before dataset load
    const wipeBlock = src.indexOf('if (clearCaches)');
    const clearCall = src.indexOf('clearHubCache()');
    assert.ok(wipeBlock > 0, 'expected clearCaches gate');
    assert.ok(clearCall > wipeBlock, 'clearHubCache must sit inside clearCaches gate');
  });

  it('keeps FutureCast Lab warm off priority path unless opted in', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'lib/recruiting-hub-cache.js'), 'utf8');
    assert.match(src, /HUB_BOOT_WARM_FUTURECAST === 'true'/);
    assert.match(src, /warmFuturecastLabCaches/);
  });

  it('recruiting-light cron does not geoBackfill on every hub refresh', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'scripts/render-recruiting-light-cron.js'),
      'utf8'
    );
    assert.doesNotMatch(src, /hub\/refresh\?geoBackfill=true/);
    assert.match(src, /\/api\/recruiting\/hub\/refresh/);
  });
});
