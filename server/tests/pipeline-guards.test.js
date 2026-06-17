const test = require('node:test');
const assert = require('node:assert/strict');

const guards = require('../lib/pipeline-guards');

test('normalizeIntel coerces null and fills defaults', () => {
  const intel = guards.normalizeIntel(null);
  assert.equal(intel.eventType, 'unknown');
  assert.equal(intel.text, '');
  assert.equal(intel.player, null);
});

test('normalizeIntel preserves playerName as player object', () => {
  const intel = guards.normalizeIntel({ playerName: 'John Doe', detail: 'visit note' });
  assert.equal(intel.player.name, 'John Doe');
  assert.equal(intel.text, 'visit note');
});

test('pipelinesSkipped returns stable shape', () => {
  assert.deepEqual(guards.pipelinesSkipped('test'), { ok: false, skipped: true, reason: 'test' });
});

test('kill switches default off unless env true', () => {
  const prev = { ...process.env };
  delete process.env.X_PIPELINES_ENABLED;
  delete process.env.X_AUTOPOST_ENABLED;
  delete process.env.X_SCHEDULED_JOBS_ENABLED;
  assert.equal(guards.pipelinesEnabled(), false);
  assert.equal(guards.autopostEnabled(), false);
  assert.equal(guards.scheduledJobsEnabled(), false);
  process.env = prev;
});
