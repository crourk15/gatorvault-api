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
    assert.match(issue.action, /Rebuild Film Room catalog/);
  });

  it('API Health slow + 0% 5xx → ignore-ok, go post', () => {
    const issue = enrichIssueFromTile({
      id: 'api-health',
      label: 'API Health',
      status: 'yellow',
      summary: '49 reqs · 0% 5xx · 240ms avg',
    });
    assert.equal(issue.mode, 'ignore-ok');
    assert.equal(issue.route, '#beat-desk/desk');
    assert.match(issue.coach.doThisNow, /Ignore|Go post|Beat Desk/i);
    assert.doesNotMatch(issue.coach.doThisNow, /Sit tight/i);
  });

  it('score-only product_intel_below_90 → ignore-ok, Go post (no Recompute trap)', () => {
    const issue = enrichAppStoreGateIssue({
      requiredDays: 7,
      piMin: 90,
      consecutiveGreenDays: 0,
      readyForSubmission: false,
      evaluation: {
        green: false,
        reasons: ['product_intel_below_90'],
        productIntelOverall: 76,
      },
      sample: { productIntelOverall: 76 },
    });
    assert.ok(issue);
    assert.equal(issue.severity, 'yellow');
    assert.equal(issue.mode, 'ignore-ok');
    assert.equal(issue.coach.mode, 'ignore-ok');
    assert.equal(issue.route, '#beat-desk/desk');
    assert.equal(issue.actionType, null);
    assert.match(issue.action, /Go post|Beat Desk/i);
    assert.match(issue.coach.doThisNow, /Go post|Beat Desk/i);
    assert.notEqual(issue.actionType, 'pi-recompute');
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
        productIntelOverall: 76,
      },
      sample: { productIntelOverall: 76 },
    });
    assert.ok(issue);
    assert.equal(issue.severity, 'yellow');
    assert.match(issue.why || '', /report card|score|Product Health|76/i);
  });

  it('covers score red tiles with job or route', () => {
    for (const id of Object.keys(PLAYBOOK)) {
      const pb = forTile({ id, label: id, status: 'red' });
      assert.ok(pb.howTo && pb.fixLabel, id);
      assert.ok(pb.jobId || pb.route, id);
    }
  });

  it('ships Clear the red fixer + coach skip ignore-ok + navigate after fix', () => {
    const html = fs.readFileSync(path.join(ROOT, 'admin.html'), 'utf8');
    const coach = fs.readFileSync(path.join(ROOT, 'js/admin-hub-coach.js'), 'utf8');
    const fixer = fs.readFileSync(path.join(ROOT, 'js/admin-hub-fixer.js'), 'utf8');
    assert.match(html, /admin-hub-fixer\.js\?v=hub-fixer-v/);
    assert.match(html, /admin-hub-coach\.js\?v=hub-coach-v5/);
    assert.match(coach, /Clear the red|Go post|ignore-ok|easiest path/);
    assert.match(coach, /mode === 'ignore-ok'/);
    assert.match(coach, /#beat-desk\/desk/);
    assert.match(fixer, /Clear the red/);
  });
});
