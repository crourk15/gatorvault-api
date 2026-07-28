/**
 * Red/yellow ops tile + App Store gate → plain-English fix playbook.
 * Run: node --test server/test/ops-fix-playbook.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  enrichIssueFromTile,
  enrichAppStoreGateIssue,
  forTile,
  PLAYBOOK,
} = require('../lib/ops-fix-playbook');

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
    assert.ok(issue.coach && issue.coach.plain);
  });

  it('translates product_intel_below_90 into Charles English + coach', () => {
    const issue = enrichAppStoreGateIssue({
      requiredDays: 7,
      piMin: 90,
      consecutiveGreenDays: 0,
      readyForSubmission: false,
      evaluation: {
        green: false,
        reasons: ['product_intel_below_90'],
        productIntelOverall: 78,
      },
      sample: { productIntelOverall: 78 },
    });
    assert.ok(issue);
    assert.equal(issue.severity, 'yellow');
    assert.match(issue.detail, /78/);
    assert.match(issue.why, /report card|not a message from Apple/i);
    assert.match(issue.fixHowTo, /Product Health|Recompute|red ops/i);
    assert.equal(issue.actionType, 'pi-recompute');
    assert.match(issue.coach.dontWorry, /App Store Connect/i);
  });

  it('covers core red tiles with job or route', () => {
    for (const id of Object.keys(PLAYBOOK)) {
      const pb = forTile({ id, label: id, status: 'red' });
      assert.ok(pb.howTo && pb.fixLabel, id);
      assert.ok(pb.jobId || pb.route, id);
    }
  });

  it('Full Ops + Ops Summary + Coach expose Rebuild Film Room catalog', () => {
    const opsHtml = fs.readFileSync(path.join(ROOT, 'admin-ops.html'), 'utf8');
    const opsJs = fs.readFileSync(path.join(ROOT, 'js/admin-hub-ops.js'), 'utf8');
    const dash = fs.readFileSync(path.join(ROOT, 'js/admin-hub-dashboard.js'), 'utf8');
    const coach = fs.readFileSync(path.join(ROOT, 'js/admin-hub-coach.js'), 'utf8');
    const html = fs.readFileSync(path.join(ROOT, 'admin.html'), 'utf8');
    assert.match(opsHtml, /Rebuild Film Room catalog/);
    assert.match(opsJs, /film-room-weekly/);
    assert.match(dash, /fixHowTo/);
    assert.match(dash, /GVAdminCoach/);
    assert.match(coach, /Coach says/);
    assert.match(html, /admin-hub-coach\.js\?v=hub-coach-v1/);
  });
});
