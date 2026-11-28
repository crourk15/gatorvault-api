'use strict';

/**
 * Portal / recruiting panel titles should be a command header, not stacked
 * class-hub copy.
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

describe('recruiting panel elite layout', () => {
  it('Portal war room owns the title, not the class-hub date string', () => {
    const src = read('client/components/vault/recruiting/RecruitingPortalSection.tsx');
    assert.match(src, /title="Portal War Room"/);
    assert.doesNotMatch(src, /Football portal opens January 4, 2027/);
    assert.match(src, /RecruitingPanelHeader/);
  });

  it('hides the class hero while a panel tab is open', () => {
    const css = read('client/lib/vault-recruiting-hub.css');
    assert.match(css, /rh-cc-page:has\(\[data-testid="rh-panel-view"\]\)/);
    assert.match(css, /\.rh-hero-strip/);
  });

  it('panel sticky tabs are the five command tabs, not class years', () => {
    const src = read('client/lib/recruiting-hub-tabs.ts');
    assert.match(src, /RECRUITING_PANEL_TAB_ITEMS/);
    assert.match(src, /id: 'portal'/);
    const panelView = read('client/components/recruiting-hub/RecruitingHubPanelView.tsx');
    assert.match(panelView, /tabs=\{RECRUITING_PANEL_TAB_ITEMS\}/);
  });

  it('does not nest Scouting Department page titles inside the recruiting tab', () => {
    const src = read('client/components/recruiting-hub/RecruitingHubTabPanels.tsx');
    assert.doesNotMatch(src, /ScoutingDepartmentPage/);
    assert.match(src, /title="Scouting"/);
    assert.match(src, /title="Who's Moving"/);
    assert.match(src, /title="Priority Targets"/);
  });
});
