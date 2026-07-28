/**
 * Runbooks Charles-friendly fail copy.
 * Run: node --test server/test/admin-hub-runbooks.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

describe('Admin Hub runbooks', () => {
  it('explains wake failures in plain English', () => {
    const src = fs.readFileSync(path.join(ROOT, 'js/admin-hub-runbooks.js'), 'utf8');
    const sandbox = { window: {}, console };
    vm.runInNewContext(src, sandbox);
    const rb = sandbox.window.GVAdminRunbooks;
    assert.ok(rb && typeof rb.charlesFailMessage === 'function');
    const msg = rb.charlesFailMessage({ message: 'Waking kitchen…', wake: true }, 'Refresh live hub');
    assert.match(msg, /still starting/i);
    assert.match(msg, /2 minutes/i);
    assert.match(msg, /Refresh live hub/);
  });

  it('is cache-busted in admin.html', () => {
    const html = fs.readFileSync(path.join(ROOT, 'admin.html'), 'utf8');
    assert.match(html, /admin-hub-runbooks\.js\?v=hub-runbooks-v2/);
  });
});
