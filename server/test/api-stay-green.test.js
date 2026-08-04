'use strict';

const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

describe('api stay-green lockdown', () => {
  const prev = {
    API_STAY_GREEN: process.env.API_STAY_GREEN,
    API_STAY_GREEN_ALLOW_HEAVY: process.env.API_STAY_GREEN_ALLOW_HEAVY,
    NODE_ENV: process.env.NODE_ENV,
  };

  after(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    delete require.cache[require.resolve('../lib/api-stay-green')];
  });

  it('defaults on in production', () => {
    delete process.env.API_STAY_GREEN;
    delete process.env.API_STAY_GREEN_ALLOW_HEAVY;
    process.env.NODE_ENV = 'production';
    delete require.cache[require.resolve('../lib/api-stay-green')];
    const mod = require('../lib/api-stay-green');
    assert.equal(mod.isStayGreen(), true);
    assert.ok(mod.stayGreenSkipPayload('hub-refresh'));
    assert.equal(mod.shouldBlockOpsJob('gators-score-alerts'), true);
  });

  it('can be forced off', () => {
    process.env.API_STAY_GREEN = 'false';
    delete require.cache[require.resolve('../lib/api-stay-green')];
    const mod = require('../lib/api-stay-green');
    assert.equal(mod.isStayGreen(), false);
    assert.equal(mod.stayGreenSkipPayload('hub-refresh'), null);
  });

  it('wires skip gates into hub refresh + beat refresh + ops jobs', () => {
    const hub = fs.readFileSync(path.join(__dirname, '..', 'lib/recruiting-hub-routes.js'), 'utf8');
    const live = fs.readFileSync(path.join(__dirname, '..', 'lib/live-routes.js'), 'utf8');
    const recruiting = fs.readFileSync(path.join(__dirname, '..', 'lib/recruiting-routes.js'), 'utf8');
    const ops = fs.readFileSync(path.join(__dirname, '..', 'lib/ops-jobs.js'), 'utf8');
    assert.match(hub, /stayGreenSkipPayload\('hub-refresh'\)/);
    assert.match(live, /stayGreenSkipPayload\('live-beat-refresh'\)/);
    assert.match(recruiting, /stayGreenSkipPayload\('recruiting-ingest'\)/);
    assert.match(recruiting, /stayGreenSkipPayload\('allowlist-intel-sweep'\)/);
    assert.match(ops, /shouldBlockOpsJob/);
  });
});
