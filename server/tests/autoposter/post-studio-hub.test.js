/** Post Studio hub mode — manual drafts vs limited autoposter queue. */
const test = require('node:test');
const assert = require('node:assert/strict');

test('x-autoposter-hub defaults to hub mode', () => {
  delete process.env.X_AUTOPOST_HUB_MODE;
  delete process.env.X_AUTOPOST_AUTO_COMMITS;
  const hub = require('../../lib/x-autoposter-cadence');
  assert.equal(hub.isHubModeEnabled(), true);
  assert.equal(hub.autoCommitsEnabled(), false);
  assert.equal(hub.autoQueueMax(), 2);
});

test('resolveEnqueueStatus routes commits to hub_review by default', () => {
  process.env.X_AUTOPOST_HUB_MODE = 'true';
  process.env.X_AUTOPOST_AUTO_COMMITS = 'false';
  process.env.X_AUTOPOST_SCHEDULER_ENABLED = 'false';
  const hub = require('../../lib/x-autoposter-cadence');
  const status = hub.resolveEnqueueStatus({
    text: 'Five-star DL commits to Florida.',
    sourceEventType: 'commit',
    playerSlug: 'test-player'
  });
  assert.equal(status, 'hub_review');
});

test('autoposter scheduler off by default in hub mode', () => {
  process.env.X_AUTOPOST_ENABLED = 'true';
  process.env.X_PIPELINES_ENABLED = 'true';
  process.env.X_AUTOPOST_HUB_MODE = 'true';
  delete process.env.X_AUTOPOST_SCHEDULER_ENABLED;
  const guards = require('../../lib/pipeline-guards');
  assert.equal(guards.autoposterSchedulerEnabled(), false);
  assert.equal(guards.autoposterComposeEnabled(), true);
});

test('withIngestLock skips overlapping runs', async () => {
  const { withIngestLock, isIngestRunning } = require('../../lib/ingest-run-guard');
  const slow = withIngestLock('test-lock', async () => {
    await new Promise((r) => setTimeout(r, 50));
    return { ok: true };
  });
  const skip = withIngestLock('test-lock', async () => ({ ok: true }));
  const out = await Promise.all([slow, skip]);
  assert.equal(out[1].skipped, true);
  assert.equal(out[1].reason, 'already_running');
  assert.equal(isIngestRunning('test-lock'), false);
});

test('buildCronTiles does not yellow on-demand jobs without heartbeat', () => {
  const { buildCronTiles } = require('../../lib/ops-status');
  const tiles = buildCronTiles({}, { subsystems: {} });
  const beatWriter = tiles.find((j) => j.jobId === 'beat-writer-ingest');
  assert.ok(beatWriter);
  assert.equal(beatWriter.heartbeatRequired, false);
  assert.equal(beatWriter.status, 'green');
});
