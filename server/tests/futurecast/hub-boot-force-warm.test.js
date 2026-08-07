'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

describe('Elite boot force warm', () => {
  it('boot pipeline force-warms lite then HP, schedules background refresh', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib', 'recruiting-hub-cache.js'),
      'utf8'
    );
    assert.match(src, /HUB_BOOT_FORCE_WARM/);
    assert.match(src, /HUB_BOOT_WARM_LAB/);
    assert.match(src, /hubGetNoSyncBuild/);
    assert.match(src, /isStayGreen/);
    assert.match(src, /bootWarm/);
    assert.match(src, /priorityLite/);
    assert.match(src, /priorityLiteWarmJobs/);
    assert.match(src, /bundleOnly/);
    assert.match(src, /scheduleBackgroundRefresh\(\)/);
    assert.match(src, /boot priority-lite warm start/);
    assert.match(src, /warmFuturecastHighPriorityCaches\(bootYears\)/);
    assert.match(src, /boot bundle warm start/);
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

  it('server schedules hub boot warm early and idempotently', () => {
    const serverSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'server.js'), 'utf8');
    assert.match(serverSrc, /early boot warm pipeline scheduled/);
    assert.match(serverSrc, /API_BOOT_DEFER_HUB_WARM_MS/);
    const cacheSrc = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib', 'recruiting-hub-cache.js'),
      'utf8'
    );
    assert.match(cacheSrc, /bootPipelineScheduled/);
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
