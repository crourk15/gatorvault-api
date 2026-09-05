'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

let tmpDir;
let store;

function loadStore(dir) {
  process.env.GV_MEMBER_ACTIVITY_DIR = dir;
  delete require.cache[require.resolve('../lib/member-activity-store')];
  return require('../lib/member-activity-store');
}

describe('member-activity-store', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-mem-act-'));
    store = loadStore(tmpDir);
  });

  afterEach(() => {
    delete process.env.GV_MEMBER_ACTIVITY_DIR;
    delete require.cache[require.resolve('../lib/member-activity-store')];
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('sanitizes vault paths and rejects junk', () => {
    assert.equal(store.sanitizeActivityPath('/vault/recruiting/?utm=1'), '/vault/recruiting');
    assert.equal(store.sanitizeActivityPath('/vault/player/mikel-morgan/'), '/vault/player/mikel-morgan');
    assert.equal(store.sanitizeActivityPath('/login'), '/login');
    assert.equal(store.sanitizeActivityPath('/session'), '/session');
    assert.equal(store.sanitizeActivityPath('https://gatorvaultinsider.com/vault/team/'), '/vault/team');
    assert.equal(store.sanitizeActivityPath('/admin/hub'), null);
    assert.equal(store.sanitizeActivityPath('javascript:alert(1)'), null);
    assert.equal(store.sanitizeActivityPath('/vault/../users.json'), null);
  });

  it('records last-seen and a short trail', () => {
    const t0 = '2026-09-05T12:00:00.000Z';
    const t1 = '2026-09-05T12:01:00.000Z';
    store.recordMemberActivity({
      email: 'trial@example.com',
      name: 'Trial Fan',
      path: '/vault/recruiting',
      client: 'ios',
      at: t0,
    });
    store.recordMemberActivity({
      email: 'trial@example.com',
      name: 'Trial Fan',
      path: '/vault/futurecast',
      client: 'ios',
      at: t1,
    });

    const listed = store.listActivity({ sinceMs: Date.parse('2026-09-05T00:00:00.000Z') });
    assert.equal(listed.total, 1);
    assert.equal(listed.members[0].lastPath, '/vault/futurecast');
    assert.equal(listed.members[0].lastClient, 'ios');
    assert.equal(listed.members[0].trail.length, 2);
    assert.equal(listed.members[0].trail[0].path, '/vault/futurecast');
  });

  it('debounces the same path within 8s', () => {
    const t0 = '2026-09-05T12:00:00.000Z';
    const t1 = '2026-09-05T12:00:04.000Z';
    store.recordMemberActivity({
      email: 'a@b.com',
      path: '/vault/',
      client: 'website',
      at: t0,
    });
    const second = store.recordMemberActivity({
      email: 'a@b.com',
      path: '/vault/',
      client: 'website',
      at: t1,
    });
    assert.equal(second.recorded, false);
    assert.equal(second.reason, 'debounce');
    const listed = store.listActivity({ sinceMs: Date.parse('2026-09-04T00:00:00.000Z') });
    assert.equal(listed.members[0].trail.length, 1);
  });

  it('hides members outside the window', () => {
    store.recordMemberActivity({
      email: 'old@b.com',
      path: '/vault/team',
      client: 'website',
      at: '2026-08-01T12:00:00.000Z',
    });
    store.recordMemberActivity({
      email: 'new@b.com',
      path: '/vault/team',
      client: 'ios',
      at: '2026-09-05T12:00:00.000Z',
    });
    const listed = store.listActivity({ sinceMs: Date.parse('2026-09-04T12:00:00.000Z') });
    assert.equal(listed.total, 1);
    assert.equal(listed.members[0].email, 'new@b.com');
  });
});
