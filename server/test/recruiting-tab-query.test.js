'use strict';

/**
 * Who's Moving used to write ?tab=movement. That is not a hub tab key, so
 * resolveRecruitingTab fell through to the elite class hub (2028 open cycle).
 *
 * Run: node --experimental-strip-types --test server/test/recruiting-tab-query.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  recruitingTabFromQuery,
  recruitingTabPath,
  parseRecruitingTabFromPath,
  resolveRecruitingTab,
} = require('../../client/lib/vault-route-map.ts');
const { isRecruitingPanelTab } = require('../../client/lib/recruiting-hub-tabs.ts');

describe('recruiting Who\u2019s Moving tab query', () => {
  it('maps movement / intel / heat aliases onto the intel panel', () => {
    assert.equal(recruitingTabFromQuery('movement'), 'intel');
    assert.equal(recruitingTabFromQuery('intel'), 'intel');
    assert.equal(recruitingTabFromQuery('heat'), 'intel');
    assert.equal(recruitingTabFromQuery('heat-check'), 'intel');
    assert.equal(recruitingTabFromQuery('portal'), 'portal');
    assert.equal(recruitingTabFromQuery(''), null);
    assert.equal(recruitingTabFromQuery(null), null);
  });

  it('writes ?tab=intel so the click round-trips', () => {
    assert.match(recruitingTabPath('intel'), /[?&]tab=intel(?:&|$)/);
    assert.doesNotMatch(recruitingTabPath('intel'), /tab=movement/);
  });

  it('keeps /vault/recruiting/movement on intel, not the class hub', () => {
    assert.equal(parseRecruitingTabFromPath('/vault/recruiting/movement'), 'intel');
    assert.equal(parseRecruitingTabFromPath('/recruiting-hub/movement'), 'intel');
  });

  it('treats intel as a dedicated panel, not the elite class hub', () => {
    assert.equal(isRecruitingPanelTab('intel'), true);
    assert.equal(isRecruitingPanelTab('portal'), true);
    assert.equal(isRecruitingPanelTab('commits-2027'), false);
  });

  it('resolveRecruitingTab keeps ?tab=movement on intel', () => {
    global.window = {
      location: { pathname: '/vault/recruiting', search: '?tab=movement' },
    };
    assert.equal(resolveRecruitingTab('/vault/recruiting'), 'intel');
    global.window.location.search = '?tab=intel';
    assert.equal(resolveRecruitingTab('/vault/recruiting'), 'intel');
    global.window.location.search = '?tab=portal';
    assert.equal(resolveRecruitingTab('/vault/recruiting'), 'portal');
    delete global.window;
  });
});
