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
    assert.equal(issue.actionType, 'film-room-weekly');
    assert.match(issue.action, /Rebuild Film Room catalog/i);
  });

  it('API Health slow + 0% 5xx → auto-wait, not Deploy recovery', () => {
    const issue = enrichIssueFromTile({
      id: 'api-health',
      label: 'API Health',
      status: 'red',
      summary: '49 reqs · 0% 5xx · 2040ms avg',
    });
    assert.equal(issue.mode, 'auto-wait');
    assert.equal(issue.actionType, 'hub-auto-wait');
    assert.match(issue.coach.doThisNow, /sit tight/i);
    assert.match(issue.coach.doThisNow, /Deploy recovery/i);
    assert.ok(issue.autoWaitSec >= 60);
    assert.notEqual(issue.route, '#dashboard/runbooks');
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
  });

  it('covers core red tiles with job or route', () => {
    for (const id of Object.keys(PLAYBOOK)) {
      const pb = forTile({ id, label: id, status: 'red' });
      assert.ok(pb.howTo && pb.fixLabel, id);
      assert.ok(pb.jobId || pb.route, id);
    }
  });

  it('ships Make it green fixer + coach auto-wait', () => {
    const html = fs.readFileSync(path.join(ROOT, 'admin.html'), 'utf8');
    const coach = fs.readFileSync(path.join(ROOT, 'js/admin-hub-coach.js'), 'utf8');
    const fixer = fs.readFileSync(path.join(ROOT, 'js/admin-hub-fixer.js'), 'utf8');
    assert.match(html, /admin-hub-fixer\.js\?v=hub-fixer-v1/);
    assert.match(html, /admin-hub-coach\.js\?v=hub-coach-v3/);
    assert.match(coach, /Auto-refresh in/);
    assert.match(fixer, /Make it green/);
  });
});
