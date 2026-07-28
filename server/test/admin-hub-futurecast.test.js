/**
 * Admin Hub FutureCast / allowlist control surface.
 * Run: node --test server/test/admin-hub-futurecast.test.js
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-hub-fc-'));
const allowPath = path.join(tmpDir, 'admin-allowlist.json');
process.env.GV_ADMIN_ALLOWLIST_PATH = allowPath;

const {
  buildFutureCastHubSummary,
  addAllowlistTarget,
  removeAllowlistTarget,
} = require('../lib/admin-hub-futurecast');
const hub = require('../lib/admin-hub-routes');

before(() => {
  fs.writeFileSync(
    allowPath,
    JSON.stringify({ version: 1, updatedAt: null, slugs2027: [], slugs2028: [], names: {} }, null, 2)
  );
});

after(() => {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

describe('FutureCast hub summary', () => {
  it('returns counts + board/watch samples', () => {
    const summary = buildFutureCastHubSummary();
    assert.equal(summary.ok, true);
    assert.ok(summary.counts);
    assert.ok(typeof summary.counts.locked2027 === 'number');
    assert.ok(typeof summary.counts.board2028 === 'number');
    assert.ok(Array.isArray(summary.adminAllowlist2028));
    assert.match(summary.notes.closingClass2027, /Hard-locked/);
  });

  it('adds and removes 2028 allowlist extras; blocks 2027', () => {
    const blocked = addAllowlistTarget({
      slug: 'fake-2027-player',
      name: 'Fake 2027',
      classYear: 2027,
    });
    assert.equal(blocked.added, false);
    assert.equal(blocked.reason, 'closing_class_2027_hard_locked');

    const added = addAllowlistTarget({
      slug: 'hub-elite-test-player',
      name: 'Hub Elite Test Player',
      classYear: 2028,
    });
    assert.equal(added.added, true);

    const summary = buildFutureCastHubSummary();
    assert.ok(summary.adminAllowlist2028.some((r) => r.slug === 'hub-elite-test-player'));

    const removed = removeAllowlistTarget({ slug: 'hub-elite-test-player', classYear: 2028 });
    assert.equal(removed.removed, true);

    const after = buildFutureCastHubSummary();
    assert.ok(!after.adminAllowlist2028.some((r) => r.slug === 'hub-elite-test-player'));
  });
});

describe('module health includes futurecast + legacy', () => {
  it('exposes new module ids without fake-green settings', () => {
    assert.ok(hub.MODULE_IDS.includes('futurecast'));
    assert.ok(hub.MODULE_IDS.includes('legacy'));
    const map = hub.buildModuleHealthMap({
      ops: { overall: 'green', tiles: [] },
      qa: { pass: true, failed: 0 },
      productIntel: { fixQueueOpen: 0, overall: 90 },
      selfRunner: { queue: { pending: 0 }, enabled: true },
    });
    assert.equal(map.futurecast, 'green');
    assert.equal(map.settings, 'unknown');
    assert.ok(map.legacy);
  });
});
