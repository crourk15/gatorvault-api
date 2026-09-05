/**
 * Admin Hub elite IA contracts — sections, labels, scripts, refresh behavior markers.
 * Run: node --test server/test/admin-hub-elite-ia.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

describe('Admin Hub elite IA', () => {
  const core = fs.readFileSync(path.join(ROOT, 'js/admin-hub-core.js'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'admin.html'), 'utf8');
  const docs = fs.readFileSync(path.join(ROOT, '..', 'docs/ADMIN_HUB.md'), 'utf8');

  it('defaults to Beat Desk and includes FutureCast primary section', () => {
    assert.match(core, /location\.hash \|\| '#beat-desk\/desk'/);
    assert.match(core, /id: 'futurecast'/);
    assert.match(core, /group: 'primary'/);
    assert.match(core, /group: 'legacy'/);
    assert.match(core, /Legacy consoles/);
  });

  it('uses honest Team + Settings copy', () => {
    assert.match(core, /Roster & board editor/);
    assert.doesNotMatch(core, /desc: 'Schedule, opponents, depth chart, staff, film room, game zone'/);
    assert.match(core, /no feature-flag UI/);
    assert.doesNotMatch(core, /desc: 'Global config, feature flags, admin users, security'/);
  });

  it('removes duplicate GM Runbooks tab (Dashboard owns Runbooks)', () => {
    assert.match(core, /id: 'gm2'/);
    assert.match(core, /label: 'GM Integrity'/);
    // GM section should not declare a rerun/runbooks inline panel anymore.
    const gmBlock = core.slice(core.indexOf("id: 'gm2'"), core.indexOf("id: 'product-intel'"));
    assert.doesNotMatch(gmBlock, /id: 'rerun'/);
    assert.doesNotMatch(gmBlock, /label: 'Runbooks'/);
  });

  it('re-renders inline panels on every visit', () => {
    assert.match(core, /Re-render on every visit/);
    // Old one-shot guard must not short-circuit renders.
    assert.doesNotMatch(core, /if \(!panelEl\.getAttribute\('data-rendered'\)\) \{/);
  });

  it('wires FutureCast script + cache-busted core/desk', () => {
    assert.match(html, /admin-hub-futurecast\.js\?v=hub-fc-v8/);
    assert.match(html, /admin-hub-core\.js\?v=hub-core-v12/);
    assert.match(html, /admin-hub-members-activity\.js\?v=hub-mem-act-v1/);
    assert.match(html, /admin-hub-beat-desk\.js\?v=hub-bd-v18/);
    assert.match(html, /#futurecast\/control/);
  });

  it('flashes critical red when API is 502 (not soft wake)', () => {
    assert.match(html, /hub-api-banner--critical/);
    assert.match(html, /@keyframes hub-api-flash/);
    assert.match(html, /hub-ops-strip--api-down/);
    assert.match(html, /id="hub-api-light"/);
    assert.match(html, /hub-api-light--ok/);
    assert.match(html, /hub-api-light--down/);
    assert.match(core, /probeApiAlive/);
    assert.match(core, /setApiStatusLight/);
    assert.match(core, /\/api\/ping/);
    assert.match(core, /level === 'critical'/);
    assert.match(core, /API DOWN/);
    assert.match(core, /App Store \/ War Room login will fail/);
    assert.match(core, /HEALTH_POLL_DOWN_MS = 15000/);
    // Soft wake must not swallow hard 502 into orange-only copy.
    assert.match(core, /status === 502 \|\| status === 504/);
    assert.match(docs, /API status light/);
  });

  it('docs list Beat Desk default + FutureCast control', () => {
    assert.match(docs, /#beat-desk\/desk/);
    assert.match(docs, /#futurecast\/control/);
    assert.match(docs, /#members\/activity/);
    assert.match(docs, /Legacy consoles/);
    assert.match(docs, /re-render on every visit/i);
  });

  it('Members section includes Activity panel', () => {
    assert.match(core, /id: 'activity'/);
    assert.match(core, /GVAdminMembersActivity/);
    assert.match(core, /#members\/activity|#members\/recent|panelId === 'activity'/);
  });
});
