'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

describe('Elite boot force warm', () => {
  it('boot pipeline force-warm schedules priority then lab without early-return killing refresh', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib', 'recruiting-hub-cache.js'),
      'utf8'
    );
    assert.match(src, /HUB_BOOT_FORCE_WARM/);
    assert.match(src, /HUB_BOOT_WARM_LAB/);
    assert.match(src, /hubGetNoSyncBuild/);
    assert.match(src, /scheduleBackgroundRefresh\(\)/);
    assert.match(src, /boot priority warm start/);
    assert.match(src, /warmFuturecastLabCaches\(bootYears\)/);
    assert.match(src, /HUB_BOOT_SECONDARY_WARM/);
    // GET no-sync implies boot force-warm unless explicitly false.
    assert.match(src, /getNoSync/);
    assert.match(src, /isStayGreen/);
    assert.match(src, /bootWarm/);
    // Must schedule background refresh before the skip return.
    const refreshIdx = src.indexOf('scheduleBackgroundRefresh();');
    const skipLogIdx = src.indexOf('boot warm skipped');
    assert.ok(refreshIdx > 0 && skipLogIdx > refreshIdx);
  });

  it('render.yaml enables force warm + lab', () => {
    const yaml = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'render.yaml'), 'utf8');
    assert.match(yaml, /HUB_BOOT_FORCE_WARM[\s\S]*value: "true"/);
    assert.match(yaml, /HUB_BOOT_WARM_LAB[\s\S]*value: "true"/);
    assert.match(yaml, /HUB_BOOT_WARM_YEARS[\s\S]*2027,2028/);
  });

  it('warm-memory accepts admin pin', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib', 'recruiting-hub-routes.js'),
      'utf8'
    );
    assert.match(src, /verifyAdminPin/);
    assert.match(src, /warm-memory/);
  });
});
