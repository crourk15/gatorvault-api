/** Deploy monitor — stale smoke/health gates should not keep tile red forever. */
const test = require('node:test');
const assert = require('node:assert/strict');
const deployMonitor = require('../../lib/deploy-monitor');

test('gateIsCurrent rejects smoke failures older than max age', () => {
  const old = {
    kind: 'smoke',
    checkedAt: '2026-06-28T16:29:24.836Z',
    ok: false
  };
  assert.equal(deployMonitor.gateIsCurrent(old, '57788e4'), false);
});

test('gateIsCurrent accepts recent smoke failure for same deploy', () => {
  const recent = {
    kind: 'smoke',
    checkedAt: new Date().toISOString(),
    ok: false,
    deployCommit: '57788e4abc'
  };
  assert.equal(deployMonitor.gateIsCurrent(recent, '57788e4abc'), true);
});
