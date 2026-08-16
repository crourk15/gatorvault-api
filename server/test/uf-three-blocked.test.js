/**
 * Run: node --test server/test/uf-three-blocked.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isBlockedRecruit, isGarbageChaseName } = require('../lib/recruiting-blocked-players');

describe('uf-three chase phantom', () => {
  it('blocks UF. Three garbage name/slug', () => {
    assert.equal(isGarbageChaseName('UF. Three'), true);
    assert.equal(
      isBlockedRecruit({
        slug: 'uf-three',
        name: 'UF. Three',
        pos: 'DL',
        school: 'Tampa',
        classYear: 2028,
        stars: 4,
      }),
      true
    );
  });

  it('keeps real chase targets', () => {
    assert.equal(isGarbageChaseName('Izayah Vickers'), false);
    assert.equal(
      isBlockedRecruit({
        slug: 'izayah-vickers',
        name: 'Izayah Vickers',
        pos: 'CB',
        school: 'Florida State Univ. School',
        classYear: 2028,
        stars: 4,
        ufProbability: 99,
      }),
      false
    );
  });
});
