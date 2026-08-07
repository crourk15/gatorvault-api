'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

describe('Spaced elite warm (bundle + Lab)', () => {
  it('buildHubBundle defaults to sequential parts with event-loop yields', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib', 'recruiting-hub-elite.js'),
      'utf8'
    );
    assert.match(src, /HUB_BUNDLE_SEQUENTIAL/);
    assert.match(src, /yieldEventLoop/);
    assert.match(src, /setImmediate/);
    // Parallel path remains opt-in only.
    assert.match(src, /Promise\.all\(parts\.map/);
  });

  it('response-cache exposes master-board and HP warm helpers', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'api', 'futurecast', 'response-cache.ts'),
      'utf8'
    );
    assert.match(src, /warmFuturecastMasterBoard/);
    assert.match(src, /warmFuturecastHighPriorityCaches/);
    assert.match(src, /primeFuturecastCache/);
  });

  it('scheduleSpacedEliteFill queues HP then bundle then master with gaps', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib', 'recruiting-hub-cache.js'),
      'utf8'
    );
    assert.match(src, /function scheduleSpacedEliteFill/);
    assert.match(src, /HUB_SPACED_WARM_GAP_MS/);
    assert.match(src, /HUB_SPACED_WARM_YEARS/);
    assert.match(src, /futurecast-hp:/);
    assert.match(src, /hub-bundle:/);
    assert.match(src, /futurecast-master-board/);
    assert.match(src, /clearSpacedEliteTimers/);
    // Boot lite then spaced — not immediate HP(bootYears).
    assert.match(src, /boot priority-lite warm complete/);
    assert.match(src, /scheduleSpacedEliteFill\(\{/);
  });

  it('scheduleSpacedEliteFill is idempotent without force', () => {
    const prevGap = process.env.HUB_SPACED_WARM_GAP_MS;
    const prevStart = process.env.HUB_SPACED_WARM_START_MS;
    const prevMaster = process.env.HUB_SPACED_WARM_MASTER;
    process.env.HUB_SPACED_WARM_GAP_MS = '240000';
    process.env.HUB_SPACED_WARM_START_MS = '180000';
    process.env.HUB_SPACED_WARM_MASTER = 'false';

    delete require.cache[require.resolve('../../lib/recruiting-hub-cache')];
    const { scheduleSpacedEliteFill } = require('../../lib/recruiting-hub-cache');

    const first = scheduleSpacedEliteFill({
      years: [2028],
      includeLab: true,
      includeBundle: true,
    });
    assert.equal(first.ok, true);
    assert.equal(first.queued, true);
    assert.equal(first.steps, 2); // hp + bundle (master off)

    const second = scheduleSpacedEliteFill({
      years: [2028],
      includeLab: true,
      includeBundle: true,
    });
    assert.equal(second.already, true);

    const forced = scheduleSpacedEliteFill({
      years: [2028],
      includeLab: false,
      includeBundle: true,
      force: true,
    });
    assert.equal(forced.already, undefined);
    assert.equal(forced.steps, 1);

    if (prevGap == null) delete process.env.HUB_SPACED_WARM_GAP_MS;
    else process.env.HUB_SPACED_WARM_GAP_MS = prevGap;
    if (prevStart == null) delete process.env.HUB_SPACED_WARM_START_MS;
    else process.env.HUB_SPACED_WARM_START_MS = prevStart;
    if (prevMaster == null) delete process.env.HUB_SPACED_WARM_MASTER;
    else process.env.HUB_SPACED_WARM_MASTER = prevMaster;
    delete require.cache[require.resolve('../../lib/recruiting-hub-cache')];
  });
});
