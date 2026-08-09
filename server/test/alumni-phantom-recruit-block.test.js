'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('alumni / roster phantom recruit hard-block', () => {
  it('blocks alumni legends and roster bleed slugs', () => {
    const { isBlockedRecruit, isEmptyAthPhantomShell } = require('../lib/recruiting-blocked-players');
    assert.equal(isBlockedRecruit({ slug: 'urban-meyer', name: 'Urban Meyer' }), true);
    assert.equal(isBlockedRecruit({ slug: 'kyle-trask', name: 'Kyle Trask' }), true);
    assert.equal(isBlockedRecruit({ slug: 'percy-harvin', name: 'Percy Harvin' }), true);
    assert.equal(isBlockedRecruit({ slug: 'dallas-wilson', name: 'Dallas Wilson' }), true);
    assert.equal(isBlockedRecruit({ slug: 'tramell-jones', name: 'Tramell Jones' }), true);
    assert.equal(
      isEmptyAthPhantomShell({
        slug: 'urban-meyer',
        name: 'Urban Meyer',
        pos: 'ATH',
        school: '',
        ufProbability: 0,
      }),
      true
    );
  });

  it('does not treat slug-only allowlist probes as empty shells', () => {
    const { isEmptyAthPhantomShell, isBlockedRecruit } = require('../lib/recruiting-blocked-players');
    assert.equal(isEmptyAthPhantomShell({ slug: 'asher-ghioto' }), false);
    assert.equal(isBlockedRecruit({ slug: 'asher-ghioto' }), false);
    assert.equal(isBlockedRecruit({ slug: 'izayah-vickers', name: 'Izayah Vickers' }), false);
  });

  it('refuses desk intel FutureCast feed for alumni', async () => {
    const { feedDeskIntelToFutureCast } = require('../lib/desk-intel-futurecast-feed');
    const r = await feedDeskIntelToFutureCast({
      slug: 'kyle-trask',
      player: { slug: 'kyle-trask', name: 'Kyle Trask', classYear: 2028, pos: 'ATH' },
      dryRun: true,
    });
    assert.equal(r.ok, false);
    assert.ok(['blocked_not_recruit', 'current_roster_player'].includes(r.error), r.error);
  });

  it('refuses admin allowlist add for alumni', () => {
    const { addToAdminAllowlist } = require('../lib/admin-allowlist-store');
    const r = addToAdminAllowlist({
      slug: 'urban-meyer',
      name: 'Urban Meyer',
      classYear: 2028,
    });
    assert.equal(r.added, false);
    assert.ok(['blocked_not_recruit', 'staff_not_recruit'].includes(r.reason), r.reason);
  });

  it('filters blocked rows from lists', () => {
    const { filterBlockedRecruits } = require('../lib/recruiting-blocked-players');
    const rows = [
      { slug: 'asher-ghioto', name: 'Asher Ghioto', pos: 'EDGE', school: 'Bolles' },
      { slug: 'urban-meyer', name: 'Urban Meyer', pos: 'ATH', school: '', ufProbability: 0 },
      { slug: 'kyle-trask', name: 'Kyle Trask', pos: 'ATH' },
    ];
    const kept = filterBlockedRecruits(rows);
    assert.equal(kept.length, 1);
    assert.equal(kept[0].slug, 'asher-ghioto');
  });
});
