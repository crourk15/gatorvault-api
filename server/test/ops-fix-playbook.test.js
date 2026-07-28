/**
 * Red/yellow ops tile → plain-English fix playbook.
 * Run: node --test server/test/ops-fix-playbook.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { enrichIssueFromTile, forTile, PLAYBOOK } = require('../lib/ops-fix-playbook');

const ROOT = path.join(__dirname, '..');

describe('ops fix playbook', () => {
  it('maps Film Room red to rebuild job + how-to', () => {
    const issue = enrichIssueFromTile({
      id: 'film-room',
      label: 'Film Room Engine',
      status: 'red',
      summary: 'Catalog 510h ago',
    });
    assert.equal(issue.severity, 'red');
    assert.equal(issue.actionType, 'film-room-weekly');
    assert.match(issue.action, /Rebuild Film Room catalog/i);
    assert.match(issue.fixHowTo, /Rebuild Film Room catalog/i);
    assert.match(issue.why, /stale|out of date/i);
    assert.equal(issue.detail, 'Catalog 510h ago');
  });

  it('covers core red tiles with job or route', () => {
    for (const id of Object.keys(PLAYBOOK)) {
      const pb = forTile({ id, label: id, status: 'red' });
      assert.ok(pb.howTo && pb.fixLabel, id);
      assert.ok(pb.jobId || pb.route, id);
    }
  });

  it('hub overview recommends film-room-weekly when film tile is red', () => {
    const routes = fs.readFileSync(path.join(ROOT, 'lib/admin-hub-routes.js'), 'utf8');
    assert.match(routes, /enrichIssueFromTile/);
    assert.match(routes, /film-room-weekly/);
    assert.match(routes, /Rebuild Film Room catalog/);
  });

  it('Full Ops + Ops Summary expose Rebuild Film Room catalog', () => {
    const opsHtml = fs.readFileSync(path.join(ROOT, 'admin-ops.html'), 'utf8');
    const opsJs = fs.readFileSync(path.join(ROOT, 'js/admin-hub-ops.js'), 'utf8');
    const dash = fs.readFileSync(path.join(ROOT, 'js/admin-hub-dashboard.js'), 'utf8');
    assert.match(opsHtml, /Rebuild Film Room catalog/);
    assert.match(opsHtml, /What to do: click Rebuild Film Room catalog/);
    assert.match(opsJs, /film-room-weekly/);
    assert.match(dash, /fixHowTo/);
    assert.match(dash, /film-room-weekly/);
  });
});
