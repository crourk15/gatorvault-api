'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');
require('tsx/cjs');

describe('master-board soft serve for iOS Lab', () => {
  it('master-board GET primes disk/HP soft before deferred building', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'api', 'futurecast', 'master-board.ts'),
      'utf8'
    );
    assert.match(src, /loadMasterBoardCached/);
    assert.match(src, /softMasterBoardFromHighPriority/);
    assert.match(src, /softOnDeferred/);
  });

  it('response-cache exposes master-board runtime + HP soft seed', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'api', 'futurecast', 'response-cache.ts'),
      'utf8'
    );
    assert.match(src, /readMasterBoardRuntime/);
    assert.match(src, /writeMasterBoardRuntime/);
    assert.match(src, /softMasterBoardFromHighPriority/);
    assert.match(src, /loadMasterBoardCached/);
    assert.match(src, /degraded: 'hp_soft_seed'/);
  });

  it('softMasterBoardFromHighPriority returns fan-ready players', () => {
    const {
      softMasterBoardFromHighPriority,
      writeMasterBoardRuntime,
      loadMasterBoardCached,
    } = require('../../api/futurecast/response-cache.ts');
    const soft = softMasterBoardFromHighPriority();
    assert.ok(soft, 'HP seed should exist for soft master-board');
    assert.notEqual(soft.status, 'building');
    assert.notEqual(soft.unavailable, true);
    assert.ok(Array.isArray(soft.players) && soft.players.length > 0);
    writeMasterBoardRuntime(soft);
    const cached = loadMasterBoardCached();
    assert.ok(cached?.players?.length > 0);
  });
});
