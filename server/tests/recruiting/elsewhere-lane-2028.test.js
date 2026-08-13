'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  ELSEWHERE_LANE_2028,
  ELSEWHERE_COMMITS_2028,
  getElsewhereLaneSlugs,
  getElsewhereCommitDefaults,
  isFlipWatchAllowlisted,
  filterAllowlistedTargets,
} = require('../../lib/recruiting-target-allowlist');
const { isActiveUfTarget } = require('../../lib/recruiting-target-filters');

describe('2028+ committed-elsewhere lane', () => {
  it('curates Cale Britt to Wisconsin and keeps him off the open hunt', () => {
    assert.ok(ELSEWHERE_LANE_2028.includes('cale-britt'));
    assert.equal(ELSEWHERE_COMMITS_2028['cale-britt'], 'Wisconsin');
    assert.equal(isFlipWatchAllowlisted('cale-britt', 2028), true);
    assert.equal(
      isActiveUfTarget({
        slug: 'cale-britt',
        classYear: 2028,
        committedTo: 'Wisconsin',
        status: 'committed',
      }),
      false
    );
  });

  it('lists vault elsewhere commits for 2028 (curated + store)', () => {
    const slugs = getElsewhereLaneSlugs(2028);
    assert.ok(slugs.includes('cale-britt'));
    assert.ok(slugs.includes('kingston-preyear'));
    assert.ok(slugs.length >= ELSEWHERE_LANE_2028.length);
    const defaults = getElsewhereCommitDefaults(2028);
    assert.equal(defaults['kingston-preyear'], 'Alabama');
  });

  it('filterAllowlistedTargets keeps elsewhere-lane commits, drops UF commits', () => {
    const rows = filterAllowlistedTargets(
      [
        {
          slug: 'cale-britt',
          name: 'Cale Britt',
          classYear: 2028,
          committedTo: 'Wisconsin',
          status: 'committed',
        },
        {
          slug: 'armani-strong',
          name: 'Armani Strong',
          classYear: 2028,
          committedTo: 'Florida',
          status: 'committed',
        },
        {
          slug: 'izayah-vickers',
          name: 'Izayah Vickers',
          classYear: 2028,
          committedTo: null,
          status: 'uncommitted',
        },
      ],
      2028
    );
    const slugs = rows.map((r) => r.slug);
    assert.ok(slugs.includes('cale-britt'));
    assert.ok(!slugs.includes('armani-strong'));
    assert.ok(slugs.includes('izayah-vickers'));
  });

  it('does not treat 2028 elsewhere as 2027 Flip Watch', () => {
    assert.equal(isFlipWatchAllowlisted('cale-britt', 2027), false);
    assert.equal(isFlipWatchAllowlisted('jalen-brewster', 2027), true);
  });
});
