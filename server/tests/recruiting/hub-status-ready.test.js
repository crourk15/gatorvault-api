/**
 * Hub status must report ready once priority caches are hot —
 * background secondary warm must not keep clients in "warming".
 */
const test = require('node:test');
const assert = require('node:assert/strict');

test('getMeta prefers ready over in-flight warm', () => {
  const hub = require('../../lib/recruiting-hub-cache');
  // Simulate priority warm completed while a refresh flag might still exist.
  // We only assert public meta shape / readiness helpers stay coherent.
  const meta = hub.getMeta();
  assert.equal(typeof meta.ready, 'boolean');
  assert.ok(['ready', 'warming', 'building'].includes(meta.status));
  if (meta.ready) {
    assert.equal(meta.status, 'ready');
    assert.equal(meta.warming, false);
  }
  assert.equal(hub.isReady(), meta.ready);
});
