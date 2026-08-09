'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('2028 Priority Chase allowlist-only slug set', () => {
  it('keeps real hunt-list targets and excludes alumni/roster phantoms', () => {
    const { getAllowlistSet } = require('../lib/recruiting-target-allowlist');
    const { isBlockedRecruit } = require('../lib/recruiting-blocked-players');
    const allow = [...getAllowlistSet(2028)]
      .map((s) => String(s).toLowerCase())
      .filter((slug) => slug && !isBlockedRecruit({ slug }));

    assert.ok(allow.includes('asher-ghioto'));
    assert.ok(allow.includes('izayah-vickers'));
    for (const phantom of [
      'kyle-trask',
      'caden-jones',
      'tramell-jones',
      'cole-best',
      'urban-meyer',
      'dallas-wilson',
    ]) {
      assert.equal(allow.includes(phantom), false, phantom);
      assert.equal(isBlockedRecruit({ slug: phantom }), true, phantom);
    }
  });
});
