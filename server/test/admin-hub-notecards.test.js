/**
 * Operator Notecards contracts — Charles-mode playbook present on desk + command center.
 * Run: node --test server/test/admin-hub-notecards.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

describe('Operator Notecards', () => {
  const nc = fs.readFileSync(path.join(ROOT, 'js/admin-hub-notecards.js'), 'utf8');
  const desk = fs.readFileSync(path.join(ROOT, 'js/admin-hub-beat-desk.js'), 'utf8');
  const dash = fs.readFileSync(path.join(ROOT, 'js/admin-hub-dashboard.js'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'admin.html'), 'utf8');

  it('ships shared notecards module with desk + command variants', () => {
    assert.match(nc, /GVAdminNotecards/);
    assert.match(nc, /Do this now/);
    assert.match(nc, /If red \/ yellow/);
    assert.match(nc, /STALE/);
    assert.match(nc, /What the buttons mean/);
    assert.match(nc, /Don't touch|Don\u2019t touch|Don\\'t touch/);
    assert.match(nc, /variant === 'desk'/);
    assert.match(nc, /variant === 'command'|command/);
  });

  it('mounts on Beat Desk and Command Center', () => {
    assert.match(desk, /GVAdminNotecards/);
    assert.match(desk, /html\('desk'/);
    assert.match(dash, /GVAdminNotecards/);
    assert.match(dash, /html\('command'/);
  });

  it('treats STALE beats as yellow warning not system red', () => {
    const desk = fs.readFileSync(path.join(ROOT, 'js/admin-hub-beat-desk.js'), 'utf8');
    assert.match(desk, /s === 'stale'\) return 'hub-st-yellow'/);
    assert.match(desk, /LIVE.*fresh|LIVE.*best to Open/i);
  });

  it('is loaded before dashboard/desk scripts with styles', () => {
    assert.match(html, /admin-hub-notecards\.js\?v=hub-nc-v10/);
    assert.match(nc, /Film Room Engine red|Rebuild Film Room catalog/);
    assert.match(nc, /product_intel_below_90|App Store gate/);
    const ncIdx = html.indexOf('admin-hub-notecards.js');
    const dashIdx = html.indexOf('admin-hub-dashboard.js');
    const deskIdx = html.indexOf('admin-hub-beat-desk.js');
    assert.ok(ncIdx > 0 && ncIdx < dashIdx && ncIdx < deskIdx);
    assert.match(html, /\.hub-notecards\{/);
  });
});
