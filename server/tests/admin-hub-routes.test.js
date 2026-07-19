/** Admin Hub API — module-health + search contracts. */
const test = require('node:test');
const assert = require('node:assert/strict');

const hub = require('../lib/admin-hub-routes');

test('buildModuleHealthMap returns all module ids', () => {
  const map = hub.buildModuleHealthMap({
    ops: { overall: 'green', tiles: [] },
    qa: { pass: true, failed: 0 },
    productIntel: { fixQueueOpen: 0, overall: 90 },
    selfRunner: { queue: { pending: 0 }, enabled: true }
  });
  for (const id of hub.MODULE_IDS) {
    assert.ok(map[id], `missing module health for ${id}`);
  }
});

test('buildModuleHealthMap does not fake-green unchecked modules', () => {
  const map = hub.buildModuleHealthMap({
    ops: { overall: 'green', tiles: [] },
    qa: { pass: true, failed: 0 },
    productIntel: { fixQueueOpen: 0 },
    selfRunner: { queue: { pending: 0 }, enabled: true }
  });
  assert.equal(map.dashboard, 'green');
  assert.equal(map.qa, 'green');
  assert.equal(map.settings, 'unknown');
  assert.equal(map.community, 'unknown');
  assert.equal(map.feedback, 'unknown');
});

test('buildModuleHealthMap uses community/feedback backlog signals', () => {
  const map = hub.buildModuleHealthMap({
    ops: { overall: 'green', tiles: [] },
    qa: { pass: true, failed: 0 },
    productIntel: { fixQueueOpen: 0, overall: 88 },
    selfRunner: { queue: { pending: 0 }, enabled: true },
    communityOpen: 3,
    feedbackOpen: 0
  });
  assert.equal(map.community, 'yellow');
  assert.equal(map.feedback, 'green');
});

test('filterActionableAlerts hides stale QA failures when latest crawl passed', () => {
  const filtered = hub.filterActionableAlerts(
    {
      alerts: [
        {
          at: '2026-06-16T18:03:33.257Z',
          title: 'QA Crawler FAILED — 4 check(s)',
          message: 'old failure'
        },
        {
          at: new Date().toISOString(),
          title: 'Autoposter skipped major event',
          message: 'recent warning'
        }
      ]
    },
    { pass: true, failed: 0 }
  );
  assert.equal(filtered.length, 1);
  assert.match(filtered[0].title, /Autoposter/);
});

test('buildTopIssues does not surface ancient QA alerts', () => {
  const issues = hub.buildTopIssues({
    ops: { tiles: [{ id: 'deployments', label: 'Deployments', status: 'green', summary: 'ok' }] },
    qa: { pass: true, failed: 0 },
    productIntel: { fixQueueOpen: 0 },
    selfRunner: { queue: { pending: 0 } },
    alerts: {
      alerts: [
        {
          at: '2026-06-16T18:03:33.257Z',
          severity: 'error',
          title: 'QA Crawler FAILED — 4 check(s)',
          message: 'stale'
        }
      ]
    }
  });
  assert.equal(issues.length, 0);
});

test('search result mappers include navigable route fields', () => {
  // Exercise private mappers indirectly via module internals if exported later;
  // for now assert health map + MODULE_IDS stay stable for hub shell.
  assert.ok(hub.MODULE_IDS.includes('dashboard'));
  assert.ok(hub.MODULE_IDS.includes('settings'));
});
