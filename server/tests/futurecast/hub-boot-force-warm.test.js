'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

describe('Elite boot force warm', () => {
  it('boot pipeline force-warms lite only and schedules background refresh', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib', 'recruiting-hub-cache.js'),
      'utf8'
    );
    assert.match(src, /HUB_BOOT_FORCE_WARM/);
    assert.match(src, /hubGetNoSyncBuild/);
    assert.match(src, /isStayGreen/);
    assert.match(src, /bootWarm/);
    assert.match(src, /priorityLite/);
    assert.match(src, /priorityLiteWarmJobs/);
    assert.match(src, /scheduleBackgroundRefresh\(\)/);
    assert.match(src, /boot priority-lite warm start/);
    assert.match(src, /bootPipelineScheduled/);
    // Boot lite first; spaced fill owns HP/bundle (not immediate dual-year stampede).
    assert.match(src, /HUB_BOOT_BUNDLE_WARM/);
    assert.match(src, /scheduleSpacedEliteFill/);
    assert.match(src, /HUB_SPACED_ELITE_WARM/);
    assert.doesNotMatch(src, /warmFuturecastHighPriorityCaches\(bootYears\)/);
    const refreshIdx = src.indexOf('scheduleBackgroundRefresh();');
    const skipLogIdx = src.indexOf('boot warm skipped');
    assert.ok(refreshIdx > 0 && skipLogIdx > refreshIdx);
  });

  it('render.yaml enables force warm + spaced elite; lab/bundle off as boot jobs', () => {
    const yaml = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'render.yaml'), 'utf8');
    assert.match(yaml, /HUB_BOOT_FORCE_WARM[\s\S]*value: "true"/);
    assert.match(yaml, /HUB_BOOT_BUNDLE_WARM[\s\S]*value: "false"/);
    assert.match(yaml, /HUB_SPACED_ELITE_WARM[\s\S]*value: "true"/);
    assert.match(yaml, /HUB_SPACED_WARM_YEARS[\s\S]*value: "2028"/);
    assert.match(yaml, /HUB_BUNDLE_SEQUENTIAL[\s\S]*value: "true"/);
    assert.match(yaml, /warm-memory\?mode=spaced&years=2028/);
  });

  it('server schedules hub boot warm early and idempotently', () => {
    const serverSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'server.js'), 'utf8');
    assert.match(serverSrc, /early boot warm pipeline scheduled/);
    assert.match(serverSrc, /API_BOOT_DEFER_HUB_WARM_MS/);
  });

  it('warm-memory accepts admin pin, lite, and spaced modes', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib', 'recruiting-hub-routes.js'),
      'utf8'
    );
    assert.match(src, /verifyAdminPin/);
    assert.match(src, /warm-memory/);
    assert.match(src, /priorityLite/);
    assert.match(src, /mode === 'spaced'/);
    assert.match(src, /scheduleSpacedEliteFill/);
  });
});
