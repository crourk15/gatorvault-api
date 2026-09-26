'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const yaml = fs.readFileSync(path.join(__dirname, '../../../render.yaml'), 'utf8');
const boot = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');

test('gatorvault-api ignores test and docs commits so disk deploys stay rare', () => {
  assert.match(yaml, /name: gatorvault-api/);
  assert.match(yaml, /buildFilter:/);
  assert.match(yaml, /server\/tests\/\*\*/);
  assert.match(yaml, /server\/scripts\/\*\*/);
  assert.match(yaml, /ignoredPaths:/);
  assert.match(yaml, /- server\/\*\*/);
  assert.match(yaml, /BOOT_HEAVY_MIN_UPTIME_SEC/);
});

test('post-listen boot yields content and does not scan community threads', () => {
  assert.match(boot, /function startPostBootServiceTail/);
  assert.match(boot, /API_BOOT_SCHED_YIELD_MS/);
  assert.match(boot, /API_POST_BOOT_DELAY_MS/);
  assert.match(boot, /API_WIRE_YIELD_MS/);
  assert.match(boot, /function loadBootModulesCore/);
  assert.match(boot, /console\.log\('Community API: ready'\)/);
  assert.equal(boot.includes('communityStore.loadThreads()'), false);
  assert.equal(boot.includes('getAllRosterPlayers().length'), false);
  const listenAt = boot.indexOf('app.listen');
  const recruitingAt = boot.indexOf("require('./lib/recruiting-routes')");
  assert.ok(listenAt > 0 && recruitingAt > listenAt, 'listen must open before heavy route requires');
});
