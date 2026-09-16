'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('tsx/cjs');

describe('FutureCast Lab Updated stamp (Aug-stale master-board)', () => {
  it('master-board GET serves DISK-STALE and schedules a rebuild', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'api', 'futurecast', 'master-board.ts'),
      'utf8'
    );
    assert.match(src, /isHpPlateFresh\(primed\)/);
    assert.match(src, /DISK-STALE/);
    assert.match(src, /scheduleMasterBoardDiskRebuild/);
    assert.match(src, /stampMasterBoardForFans\(primed\)/);
    assert.match(src, /Cache-Control.*no-store/);
  });

  it('warm rebuilds stale master-board instead of wrap-hitting the Aug seed', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'api', 'futurecast', 'response-cache.ts'),
      'utf8'
    );
    assert.match(src, /scheduleMasterBoardDiskRebuild/);
    assert.match(src, /stampMasterBoardForFans/);
    assert.match(src, /needRebuild = opts\?\.force === true \|\| existing == null \|\| !isHpPlateFresh\(existing\)/);
    assert.match(src, /writeMasterBoardRuntime\(value\)/);
    assert.match(src, /FUTURECAST_API_CACHE_VERSION = 41/);
  });

  it('stampMasterBoardForFans restamps Aug 7 from a live HP plate', () => {
    const {
      stampMasterBoardForFans,
      primeFuturecastCache,
      highPriorityCacheKey,
      isHpPlateFresh,
    } = require('../api/futurecast/response-cache.ts');
    const live = new Date().toISOString();
    primeFuturecastCache(highPriorityCacheKey(2028), {
      classYear: 2028,
      updatedAt: live,
      lastUpdated: live,
      players: [{ slug: 'test-player', name: 'Test Player' }],
    });
    const stale = {
      classYear: 2028,
      updatedAt: '2026-08-07T20:26:23.943Z',
      players: [{ slug: 'stale-row', name: 'Stale' }],
    };
    assert.equal(isHpPlateFresh(stale), false);
    const stamped = stampMasterBoardForFans(stale);
    assert.equal(stamped.updatedAt, live);
    assert.equal(stale.updatedAt, '2026-08-07T20:26:23.943Z');
  });

  it('stampMasterBoardForFans uses now when HP is also stale', () => {
    const { stampMasterBoardForFans, isHpPlateFresh } = require('../api/futurecast/response-cache.ts');
    const stale = {
      classYear: 2028,
      updatedAt: '2026-08-07T20:26:23.943Z',
      players: [{ slug: 'stale-row', name: 'Stale' }],
    };
    const stamped = stampMasterBoardForFans(stale);
    assert.equal(isHpPlateFresh(stale), false);
    assert.ok(isHpPlateFresh(stamped), 'fan stamp must be inside the 36h window');
    assert.notEqual(stamped.updatedAt, stale.updatedAt);
  });

  it('resolveLabLastUpdated ignores Aug 7 master when HP is live', () => {
    const { resolveLabLastUpdated } = require('../../client/lib/futurecast-lab-updated.ts');
    const now = Date.parse('2026-09-16T17:00:00.000Z');
    const live = '2026-09-16T16:40:00.000Z';
    const resolved = resolveLabLastUpdated({
      masterUpdatedAt: '2026-08-07T20:26:23.943Z',
      movementUpdatedAt: '2026-08-07T20:26:23.943Z',
      highPriorityUpdatedAt: live,
      nowMs: now,
    });
    assert.equal(resolved, live);
  });

  it('resolveLabLastUpdated returns null when every stamp is Aug-stale', () => {
    const { resolveLabLastUpdated } = require('../../client/lib/futurecast-lab-updated.ts');
    const now = Date.parse('2026-09-16T17:00:00.000Z');
    const resolved = resolveLabLastUpdated({
      masterUpdatedAt: '2026-08-07T20:26:23.943Z',
      movementUpdatedAt: '2026-08-13T00:00:00.000Z',
      highPriorityUpdatedAt: '2026-08-07T12:00:00.000Z',
      nowMs: now,
    });
    assert.equal(resolved, null);
  });
});
