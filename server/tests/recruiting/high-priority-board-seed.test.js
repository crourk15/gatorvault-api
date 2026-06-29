'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { enrichTargetsWithBoardSeed } = require('../../lib/target-board-enrich');
const allowlist = require('../../lib/recruiting-target-allowlist');
const { isActiveUfTarget } = require('../../lib/recruiting-target-filters');

describe('high-priority board seed parity', () => {
  it('synthesizes allowlist flip-watch targets missing from store board rows', () => {
    const storeTargets = [
      {
        slug: 'kamauri-whitfield',
        name: 'Kamauri Whitfield',
        classYear: 2027,
        category: 'target',
        committedTo: null,
      },
    ];

    const enriched = enrichTargetsWithBoardSeed(storeTargets, 2027, allowlist);
    const slugs = enriched.filter(isActiveUfTarget).map((p) => p.slug);

    assert.ok(slugs.includes('jalen-brewster'), 'brewster should be synthesized from 2027 target board seed');
    assert.ok(slugs.includes('kamauri-whitfield'), 'existing store target should remain');
  });
});
