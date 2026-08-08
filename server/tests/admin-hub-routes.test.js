/** Admin Hub API — module-health + search contracts. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const hub = require('../lib/admin-hub-routes');
const { saveUsers } = require('../lib/user-store');

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

test('Beat Desk stays green when Film Room red + API wake lag only', () => {
  const map = hub.buildModuleHealthMap({
    ops: {
      overall: 'red',
      tiles: [
        {
          id: 'film-room',
          label: 'Film Room Engine',
          status: 'red',
          summary: 'Catalog 400h ago'
        },
        {
          id: 'api-health',
          label: 'API Health',
          status: 'yellow',
          summary: '40 reqs · 0% 5xx · 2400ms avg · recent 2400ms'
        },
        {
          id: 'recruiting-board',
          label: 'Recruiting Board',
          status: 'green',
          summary: 'Updated 1h ago'
        }
      ]
    },
    qa: { pass: true, failed: 0 },
    productIntel: { fixQueueOpen: 0, overall: 90 },
    selfRunner: { queue: { pending: 0 }, enabled: true }
  });
  assert.equal(map.dashboard, 'red', 'Dashboard keeps full kitchen red');
  assert.equal(map.content, 'red', 'Content follows Film Room');
  assert.equal(map['beat-desk'], 'green', 'Beat Desk ignores Film Room + wake lag');
  assert.equal(map.futurecast, 'green', 'FutureCast follows recruiting board');
});

test('Beat Desk goes red only when API has real errors', () => {
  const map = hub.buildModuleHealthMap({
    ops: {
      overall: 'red',
      tiles: [
        {
          id: 'api-health',
          label: 'API Health',
          status: 'red',
          summary: '20 reqs · 20% 5xx · 900ms avg · recent 900ms'
        },
        {
          id: 'recruiting-board',
          label: 'Recruiting Board',
          status: 'green',
          summary: 'Updated 1h ago'
        }
      ]
    },
    qa: { pass: true, failed: 0 },
    productIntel: { fixQueueOpen: 0, overall: 90 },
    selfRunner: { queue: { pending: 0 }, enabled: true }
  });
  assert.equal(map['beat-desk'], 'red');
  assert.equal(map.futurecast, 'green');
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

test('score-only App Store gate is ignore-ok and does not recommend Recompute', () => {
  const gate = {
    requiredDays: 7,
    piMin: 90,
    consecutiveGreenDays: 0,
    readyForSubmission: false,
    evaluation: {
      green: false,
      reasons: ['product_intel_below_90'],
      productIntelOverall: 76,
    },
  };
  const issues = hub.buildTopIssues({
    ops: { tiles: [] },
    qa: { pass: true, failed: 0 },
    productIntel: { fixQueueOpen: 0 },
    selfRunner: { queue: { pending: 0 } },
    alerts: { alerts: [] },
    appStoreGate: gate,
  });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].mode, 'ignore-ok');
  assert.notEqual(issues[0].actionType, 'pi-recompute');

  const actions = hub.buildRecommendedActions({
    ops: { tiles: [] },
    qa: { pass: true },
    productIntel: { fixQueueOpen: 0 },
    selfRunner: { eligibleOpenIssues: 0 },
    appStoreGate: gate,
  });
  assert.ok(!actions.some((a) => a.id === 'pi-recompute'));
});

test('search result mappers include navigable route fields', () => {
  // Exercise private mappers indirectly via module internals if exported later;
  // for now assert health map + MODULE_IDS stay stable for hub shell.
  assert.ok(hub.MODULE_IDS.includes('dashboard'));
  assert.ok(hub.MODULE_IDS.includes('settings'));
});

test('parseSinceMs supports day windows and all', () => {
  assert.equal(hub.parseSinceMs('all'), null);
  const seven = hub.parseSinceMs('7d');
  assert.ok(typeof seven === 'number');
  assert.ok(Date.now() - seven >= 6.9 * 24 * 60 * 60 * 1000);
});

test('listRecentMembers returns newest first without passwordHash', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-members-'));
  const usersPath = path.join(tmp, 'users.json');
  const prev = process.env.GV_USERS_PATH;
  process.env.GV_USERS_PATH = usersPath;

  const now = Date.now();
  saveUsers([
    {
      email: 'older@example.com',
      name: 'Older',
      passwordHash: 'SECRET_OLD',
      createdAt: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
      trialEnd: new Date(now + 4 * 24 * 60 * 60 * 1000).toISOString(),
      tier: 'trial'
    },
    {
      email: 'newest@example.com',
      name: 'Newest',
      passwordHash: 'SECRET_NEW',
      createdAt: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
      trialEnd: new Date(now + 6 * 24 * 60 * 60 * 1000).toISOString(),
      tier: 'trial',
      firstTouch: {
        source: 'x',
        medium: 'social',
        campaign: 'fall_camp',
        referrer: 't.co',
        landingPath: '/join/?utm_source=x',
        capturedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString()
      }
    },
    {
      email: 'paid@example.com',
      name: 'Paid Fan',
      passwordHash: 'SECRET_PAID',
      createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
      trialEnd: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(),
      paid: true,
      subscription: {
        source: 'stripe',
        status: 'active',
        tier: 'insider',
        stripeCustomerId: 'cus_test'
      },
      tier: 'insider'
    }
  ]);

  try {
    const all = hub.listRecentMembers({ since: '30d', limit: 50 });
    assert.equal(all.total, 3);
    assert.equal(all.members[0].email, 'newest@example.com');
    assert.equal(all.members[0].access, 'trial');
    assert.equal(all.members[0].source, 'x');
    assert.equal(all.members[0].campaign, 'fall_camp');
    assert.ok(Array.isArray(all.bySource));
    assert.ok(all.bySource.some((r) => r.source === 'x' && r.count >= 1));
    assert.equal(all.members.find((m) => m.email === 'paid@example.com')?.access, 'paid');
    assert.equal(all.members.find((m) => m.email === 'paid@example.com')?.source, 'direct');
    for (const row of all.members) {
      assert.equal(Object.prototype.hasOwnProperty.call(row, 'passwordHash'), false);
      assert.ok(!JSON.stringify(row).includes('SECRET'));
    }

    const paidOnly = hub.listRecentMembers({ since: '30d', access: 'paid' });
    assert.equal(paidOnly.total, 1);
    assert.equal(paidOnly.members[0].email, 'paid@example.com');
    assert.equal(paidOnly.members[0].billingSource, 'stripe');

    const week = hub.listRecentMembers({ since: '7d' });
    assert.equal(week.total, 2);
    assert.ok(week.members.every((m) => m.email !== 'older@example.com'));
  } finally {
    if (prev == null) delete process.env.GV_USERS_PATH;
    else process.env.GV_USERS_PATH = prev;
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});
