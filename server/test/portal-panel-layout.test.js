'use strict';

/**
 * Portal Room lives on FutureCast. Recruiting stays the class board.
 *
 * Run: node --test server/test/portal-panel-layout.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

describe('FutureCast Portal Room layout', () => {
  it('FutureCast discovery nav has Portal Room next to Early Discovery', () => {
    const src = read('client/components/site/FutureCastSubNav.tsx');
    assert.match(src, /id: 'discovery', label: 'Early Discovery'/);
    assert.match(src, /id: 'portal', label: 'Portal Room'/);
    assert.match(src, /fc-portal-room-nav/);
  });

  it('Portal Room is its own FutureCast section, not buried under Fit', () => {
    const desktop = read('client/components/futurecast/lab/FutureCastLabPageDesktop.tsx');
    const mobile = read('client/components/futurecast/mobile/FutureCastLabPageMobile.tsx');
    assert.match(desktop, /data-testid="fc-portal-room"/);
    assert.match(desktop, /id=\{FUTURECAST_LAB_ANCHORS\.portal\} className="rh-frame"/);
    assert.match(mobile, /data-testid="fc-portal-room"/);
  });

  it('Portal Room title is needs + gap fillers, not the class list', () => {
    const src = read('client/components/vault/recruiting/RecruitingPortalSection.tsx');
    assert.match(src, /Portal Room/);
    assert.match(src, /Must buy/);
    assert.match(src, /Hold the room/);
    assert.match(src, /portal-room-steps/);
    assert.doesNotMatch(src, /RecruitingPanelHeader/);
    assert.doesNotMatch(src, /EliteCommitBoard/);
    assert.doesNotMatch(src, /RemainingTargetsStrip/);
    assert.doesNotMatch(src, /portal-class-list/);
  });

  it('Portal Room tab owns the FutureCast lab instead of sitting under Chase', () => {
    const desktop = read('client/components/futurecast/lab/FutureCastLabPageDesktop.tsx');
    const mobile = read('client/components/futurecast/mobile/FutureCastLabPageMobile.tsx');
    assert.match(desktop, /portalFocus/);
    assert.match(desktop, /fc-lab-cc-page--portal/);
    assert.match(mobile, /portalFocus/);
  });

  it('recruiting panel tabs no longer include Portal', () => {
    const src = read('client/lib/recruiting-hub-tabs.ts');
    assert.match(src, /RECRUITING_PANEL_TAB_ITEMS/);
    assert.doesNotMatch(src, /id: 'portal'/);
    const panelView = read('client/components/recruiting-hub/RecruitingHubPanelView.tsx');
    assert.match(panelView, /tabs=\{RECRUITING_PANEL_TAB_ITEMS\}/);
  });

  it('hides the class hero while a panel tab is open', () => {
    const css = read('client/lib/vault-recruiting-hub.css');
    assert.match(css, /rh-cc-page:has\(\[data-testid="rh-panel-view"\]\)/);
    assert.match(css, /\.rh-hero-strip/);
  });

  it('does not nest Scouting Department page titles inside the recruiting tab', () => {
    const src = read('client/components/recruiting-hub/RecruitingHubTabPanels.tsx');
    assert.doesNotMatch(src, /ScoutingDepartmentPage/);
    assert.match(src, /title="Scouting"/);
    assert.match(src, /title="Who's Moving"/);
    assert.match(src, /title="Priority Targets"/);
    assert.match(src, /Portal Room is on FutureCast/);
  });
});
