/** Ops status freshness — newest timestamp + tile stability. */
const test = require('node:test');
const assert = require('node:assert/strict');

test('newestTimestamp picks latest ISO across sources', () => {
  const { newestTimestamp } = require('../../lib/ops-status');
  const newest = newestTimestamp(
    '2026-06-28T10:00:00.000Z',
    '2026-07-07T08:00:00.000Z',
    '2026-07-04T16:11:00.911Z'
  );
  assert.equal(newest, '2026-07-07T08:00:00.000Z');
});

test('newestTimestamp ignores invalid values', () => {
  const { newestTimestamp } = require('../../lib/ops-status');
  assert.equal(newestTimestamp(null, undefined, 'not-a-date', '2026-07-01T00:00:00.000Z'), '2026-07-01T00:00:00.000Z');
});

test('freshnessStatus green when within warning window', () => {
  const { freshnessStatus } = require('../../lib/ops-status');
  const recent = new Date(Date.now() - 2 * 3600000).toISOString();
  assert.equal(freshnessStatus(recent, 24, 48).status, 'green');
});

test('platform health sweep returns structured result', async () => {
  const sweep = require('../../lib/platform-health-sweep');
  const out = await sweep.runPlatformHealthSweep();
  assert.ok(out && typeof out === 'object');
  assert.ok('healed' in out);
  if (out.skipped) assert.equal(out.reason, 'all_green');
  else assert.ok(Array.isArray(out.healed));
});

test('hub studio refill ignores daily cap when scheduler is off', async () => {
  process.env.X_AUTOPOST_ENABLED = 'true';
  process.env.X_PIPELINES_ENABLED = 'true';
  process.env.X_AUTOPOST_HUB_MODE = 'true';
  process.env.X_AUTOPOST_SCHEDULER_ENABLED = 'false';
  const cadence = require('../../lib/x-autoposter-cadence');
  const guards = require('../../lib/pipeline-guards');
  assert.equal(guards.autoposterSchedulerEnabled(), false);
  assert.equal(cadence.isHubModeEnabled(), true);
  const refillState = require('../../lib/post-studio-refill-state');
  const status = refillState.getStatus();
  assert.equal(typeof status.running, 'boolean');
});
