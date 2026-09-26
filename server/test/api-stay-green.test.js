'use strict';

const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

describe('api stay-green lockdown', () => {
  const prev = {
    API_STAY_GREEN: process.env.API_STAY_GREEN,
    API_STAY_GREEN_ALLOW_HEAVY: process.env.API_STAY_GREEN_ALLOW_HEAVY,
    BOOT_HEAVY_MIN_UPTIME_SEC: process.env.BOOT_HEAVY_MIN_UPTIME_SEC,
    BOOT_HEAVY_EXEMPT_JOBS: process.env.BOOT_HEAVY_EXEMPT_JOBS,
    NODE_ENV: process.env.NODE_ENV,
  };

  after(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    delete require.cache[require.resolve('../lib/api-stay-green')];
  });

  it('defaults off after App Review; opt-in blocks ops jobs', () => {
    delete process.env.API_STAY_GREEN;
    delete process.env.API_STAY_GREEN_ALLOW_HEAVY;
    delete process.env.BOOT_HEAVY_MIN_UPTIME_SEC;
    process.env.NODE_ENV = 'production';
    delete require.cache[require.resolve('../lib/api-stay-green')];
    const mod = require('../lib/api-stay-green');
    assert.equal(mod.isStayGreen(), false);
    assert.equal(mod.stayGreenSkipPayload('hub-refresh'), null);
    assert.equal(mod.shouldBlockOpsJob('gators-score-alerts'), false);
  });

  it('soft-skips heavy crons until boot uptime clears; score alerts stay live', () => {
    delete process.env.API_STAY_GREEN;
    process.env.BOOT_HEAVY_MIN_UPTIME_SEC = '480';
    delete require.cache[require.resolve('../lib/api-stay-green')];
    const mod = require('../lib/api-stay-green');
    const skipped = mod.stayGreenSkipPayload('hub-refresh');
    assert.ok(skipped);
    assert.equal(skipped.reason, 'boot_guard');
    assert.equal(skipped.skipped, true);
    assert.equal(mod.shouldBlockOpsJob('hub-refresh'), true);
    assert.equal(mod.stayGreenSkipPayload('gators-score-alerts'), null);
    assert.equal(mod.stayGreenSkipPayload('ops:gators-score-alerts'), null);
    assert.equal(mod.shouldBlockOpsJob('gators-score-alerts'), false);
  });

  it('can be forced on for lockdown', () => {
    process.env.API_STAY_GREEN = 'true';
    delete process.env.API_STAY_GREEN_ALLOW_HEAVY;
    delete process.env.BOOT_HEAVY_MIN_UPTIME_SEC;
    delete require.cache[require.resolve('../lib/api-stay-green')];
    const mod = require('../lib/api-stay-green');
    assert.equal(mod.isStayGreen(), true);
    assert.ok(mod.stayGreenSkipPayload('hub-refresh'));
    assert.equal(mod.shouldBlockOpsJob('any-random-job'), true);
  });

  it('can be forced off', () => {
    process.env.API_STAY_GREEN = 'false';
    delete process.env.BOOT_HEAVY_MIN_UPTIME_SEC;
    delete require.cache[require.resolve('../lib/api-stay-green')];
    const mod = require('../lib/api-stay-green');
    assert.equal(mod.isStayGreen(), false);
    assert.equal(mod.stayGreenSkipPayload('hub-refresh'), null);
  });

  it('wires skip gates into hub refresh + beat refresh + ops jobs + admin hub', () => {
    const hub = fs.readFileSync(path.join(__dirname, '..', 'lib/recruiting-hub-routes.js'), 'utf8');
    const live = fs.readFileSync(path.join(__dirname, '..', 'lib/live-routes.js'), 'utf8');
    const recruiting = fs.readFileSync(path.join(__dirname, '..', 'lib/recruiting-routes.js'), 'utf8');
    const ops = fs.readFileSync(path.join(__dirname, '..', 'lib/ops-jobs.js'), 'utf8');
    const admin = fs.readFileSync(path.join(__dirname, '..', 'lib/admin-hub-routes.js'), 'utf8');
    const core = fs.readFileSync(path.join(__dirname, '..', 'js/admin-hub-core.js'), 'utf8');
    const cache = fs.readFileSync(path.join(__dirname, '..', 'lib/recruiting-hub-cache.js'), 'utf8');
    assert.match(hub, /stayGreenSkipPayload\('hub-refresh'\)/);
    assert.match(live, /stayGreenSkipPayload\('live-beat-refresh'\)/);
    assert.match(recruiting, /stayGreenSkipPayload\('recruiting-ingest'\)/);
    assert.match(ops, /shouldBlockOpsJob/);
    assert.match(admin, /stayGreen: true/);
    assert.match(core, /Do NOT flash API DOWN/);
    assert.match(cache, /api_stay_green/);
  });
});
