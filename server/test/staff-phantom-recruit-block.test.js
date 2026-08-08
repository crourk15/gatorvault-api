'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('staff phantom recruit hard-block', () => {
  it('blocks Brandon Harris / Phil Trautwein as recruits', () => {
    const { isBlockedRecruit } = require('../lib/recruiting-blocked-players');
    const staff = require('../lib/recruiting-staff-directory');
    assert.equal(staff.isStaffPlayerSlug('brandon-harris'), true);
    assert.equal(staff.isStaffOrCoachName('Brandon Harris'), true);
    assert.equal(isBlockedRecruit({ slug: 'brandon-harris', name: 'Brandon Harris' }), true);
    assert.equal(isBlockedRecruit({ slug: 'phil-trautwein', name: 'Phil Trautwein' }), true);
  });

  it('refuses desk intel FutureCast feed for staff slugs', async () => {
    const { feedDeskIntelToFutureCast } = require('../lib/desk-intel-futurecast-feed');
    const r = await feedDeskIntelToFutureCast({
      slug: 'brandon-harris',
      player: { slug: 'brandon-harris', name: 'Brandon Harris', classYear: 2028, pos: 'S' },
      dryRun: true,
    });
    assert.equal(r.ok, false);
    assert.equal(r.error, 'staff_not_recruit');
  });

  it('refuses admin allowlist add for staff', () => {
    const { addToAdminAllowlist } = require('../lib/admin-allowlist-store');
    const r = addToAdminAllowlist({
      slug: 'brandon-harris',
      name: 'Brandon Harris',
      classYear: 2028,
    });
    assert.equal(r.added, false);
    assert.equal(r.reason, 'staff_not_recruit');
  });

  it('still allows real recruits', () => {
    const { isBlockedRecruit } = require('../lib/recruiting-blocked-players');
    assert.equal(isBlockedRecruit({ slug: 'asher-ghioto', name: 'Asher Ghioto' }), false);
    assert.equal(isBlockedRecruit({ slug: 'jacez-walton', name: 'Jacez Walton' }), false);
  });
});
