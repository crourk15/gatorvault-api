/** Admin Hub API — module-health response contract. */
const test = require('node:test');
const assert = require('node:assert/strict');

const hub = require('../lib/admin-hub-routes');

test('buildModuleHealthMap returns all module ids', () => {
  const map = hub.buildModuleHealthMap({
    ops: { overall: 'green', tiles: [] },
    qa: { pass: true, failed: 0 },
    productIntel: { fixQueueOpen: 0 },
    selfRunner: { queue: { pending: 0 }, enabled: true }
  });
  for (const id of hub.MODULE_IDS) {
    assert.ok(map[id], `missing module health for ${id}`);
  }
});
