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
