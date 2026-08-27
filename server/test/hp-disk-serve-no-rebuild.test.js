'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('HP DISK serve rebuild policy', () => {
  it('fresh DISK does not always rebuild; stale DISK schedules one rebuild', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'api', 'futurecast', 'high-priority.ts'),
      'utf8'
    );
    assert.match(src, /isHpPlateFresh\(healed\)/);
    assert.match(src, /DISK-STALE/);
    assert.match(src, /scheduleHighPriorityDiskRebuild\(classYear/);
    // Healed persist must not race a stale rebuild (only when fresh).
    assert.match(src, /fresh && healLookedUseful/);
    assert.match(src, /writeHighPriorityRuntime\(classYear, healed\)/);
  });

  it('warm rebuilds when plate is stale or force=true (no wrap short-circuit)', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'api', 'futurecast', 'response-cache.ts'),
      'utf8'
    );
    assert.match(src, /HP_DISK_MAX_AGE_MS/);
    assert.match(src, /export function isHpPlateFresh/);
    assert.match(src, /needRebuild = force \|\| existing == null \|\| !isHpPlateFresh\(existing\)/);
    assert.match(src, /cache\.remove\(key\)/);
    assert.match(src, /FUTURECAST_API_CACHE_VERSION = 40/);
    // Freshness uses updatedAt or lastUpdated.
    assert.match(src, /updatedAt \|\| doc\.lastUpdated/);
  });

  it('lab-warm accepts force and passes it into Lab warm', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'api', 'futurecast', 'lab-warm.ts'),
      'utf8'
    );
    assert.match(src, /warmFuturecastLabCaches\(yearsFinal, \{ force \}\)/);
  });
});
