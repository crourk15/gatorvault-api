/**
 * GNL stays current without pulling X on the dashboard request.
 * Run: node --test server/test/gnl-freshness-keeper.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { beatNeedsRefresh, DEFAULT_BEAT_MAX_AGE_MS } = require('../lib/gnl-freshness-keeper');

describe('gnl freshness keeper', () => {
  it('pulls when the beat file has no timestamp or is past the window', () => {
    const now = Date.parse('2026-10-11T22:40:00.000Z');
    assert.equal(beatNeedsRefresh(null, now), true);
    assert.equal(beatNeedsRefresh('', now), true);
    assert.equal(beatNeedsRefresh('2026-10-11T22:30:00.000Z', now, DEFAULT_BEAT_MAX_AGE_MS), false);
    assert.equal(beatNeedsRefresh('2026-10-11T22:20:00.000Z', now, DEFAULT_BEAT_MAX_AGE_MS), true);
  });

  it('starts after health is green and does not sync-warm', () => {
    const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    assert.match(server, /GNL_FRESHNESS_KEEPER_DELAY_MS \|\| '120000'/);
    assert.match(server, /startGnlFreshnessKeeper\(\)/);
    const keeper = fs.readFileSync(path.join(__dirname, '..', 'lib', 'gnl-freshness-keeper.js'), 'utf8');
    assert.match(keeper, /GNL_FRESHNESS_KEEPER === 'false'/);
    assert.match(keeper, /scheduleAsyncWarm\(\)/);
    assert.doesNotMatch(keeper, /warmDashboardCache\(/);
  });

  it('dashboard GET does not pull writers', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'live-routes.js'), 'utf8');
    const start = src.indexOf("app.get('/api/live/dashboard'");
    const end = src.indexOf("app.get('/api/gators-live'");
    assert.ok(start >= 0 && end > start);
    const dash = src.slice(start, end);
    assert.equal(dash.includes('refreshBeatStream'), false);
    assert.match(dash, /getDashboardForRequest/);
  });
});
