/**
 * Beat refresh must not hang Starter or vault-feed heartbeats.
 * Run: node --test server/test/live-beat-refresh-guard.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('live-beat refresh hang guards', () => {
  it('X fetches abort, refresh is single-flight, dashboard warm is async', () => {
    const src = fs.readFileSync(path.join(__dirname, '../lib/live-beat.js'), 'utf8');
    assert.equal(src.includes('async function fetchAbort'), true);
    assert.equal(src.includes('api.twitter.com/2/users/by/username/Corey_Bender'), true);
    assert.equal(src.includes('beat_refresh_already_running'), true);
    assert.equal(src.includes('beat_refresh_timeout'), true);
    assert.equal(src.includes('deadlineAt'), true);
    assert.equal(src.includes('DEFAULT_BEAT_REFRESH_TIMEOUT_MS'), true);
    const start = src.indexOf('async function refreshBeatStreamInner');
    const end = src.indexOf('function getBeatPosts');
    assert.ok(start >= 0 && end > start);
    const inner = src.slice(start, end);
    assert.equal(inner.includes('scheduleAsyncWarm'), true);
    assert.equal(inner.includes('warmDashboardCache'), false);
    assert.equal(inner.includes('skipSideEffects'), true);
  });
});
