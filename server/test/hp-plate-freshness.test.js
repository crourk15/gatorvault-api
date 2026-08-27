'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  HP_DISK_MAX_AGE_MS,
  isHpPlateFresh,
  getHighPriorityPlateFreshness,
  getHighPriorityFreshnessReport,
} = require('../lib/futurecast-hp-freshness');

describe('futurecast-hp-freshness', () => {
  it('treats missing/invalid updatedAt as stale and respects maxAge', () => {
    assert.equal(isHpPlateFresh(null), false);
    assert.equal(isHpPlateFresh({}), false);
    assert.equal(isHpPlateFresh({ updatedAt: 'not-a-date' }), false);
    const freshIso = new Date().toISOString();
    assert.equal(isHpPlateFresh({ updatedAt: freshIso }), true);
    const oldIso = new Date(Date.now() - HP_DISK_MAX_AGE_MS - 60_000).toISOString();
    assert.equal(isHpPlateFresh({ updatedAt: oldIso }), false);
    assert.equal(isHpPlateFresh({ lastUpdated: freshIso }), true);
  });

  it('reports 2028 plate from bundled futurecast-runtime', () => {
    const row = getHighPriorityPlateFreshness(2028);
    assert.equal(row.year, 2028);
    assert.ok(row.playerCount > 0, 'bundled 2028 HP should have players');
    assert.ok(row.updatedAt, 'bundled plate has updatedAt');
    assert.equal(typeof row.stale, 'boolean');
    assert.equal(row.maxAgeHours, 36);
  });

  it('freshness report covers 2027 and 2028', () => {
    const report = getHighPriorityFreshnessReport([2027, 2028]);
    assert.ok(report.byYear['2027']);
    assert.ok(report.byYear['2028']);
    assert.equal(typeof report.stale, 'boolean');
  });
});

describe('HP freshness wiring', () => {
  it('futurecast health exposes freshness.hp', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'api', 'futurecast', 'health.ts'),
      'utf8'
    );
    assert.match(src, /getHighPriorityFreshnessReport/);
    assert.match(src, /hpPlateStale/);
    assert.match(src, /freshness\.hp|hp: \{/);
  });

  it('pipeline healthcheck alerts and schedules rebuild on hp_plate_stale', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'lib', 'recruiting-monitoring.js'),
      'utf8'
    );
    assert.match(src, /hp_plate_stale/);
    assert.match(src, /scheduleStaleHighPriorityRebuilds/);
    assert.match(src, /'hp_plate_stale'/);
  });

  it('ops status includes FutureCast HP tile', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'ops-status.js'), 'utf8');
    assert.match(src, /futurecast-hp/);
    assert.match(src, /futurecastHpStaleHours/);
  });

  it('Admin Hub FutureCast dot includes HP tile', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'admin-hub-routes.js'), 'utf8');
    assert.match(src, /tileById\(ops, 'futurecast-hp'\)/);
  });
});
