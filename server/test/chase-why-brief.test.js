'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const brief = require('../lib/chase-why-brief');
const store = require('../lib/chase-why-store');

describe('chase-why-brief', () => {
  it('generates Vickers-style top-of-board nugget without hometown disclaimer', () => {
    const text = brief.generateWhyWeChase(
      {
        slug: 'izayah-vickers',
        name: 'Izayah Vickers',
        position: 'CB',
        ufRpmPct: 94,
        hotLanes: { staffHeat: 80, mustGetFit: 70, positionalNeed: 88 },
        hotBadges: { staffAssigned: true },
      },
      { chaseRank: 1 }
    );
    assert.match(text, /owns this CB|staff is locked on Vickers/i);
    assert.doesNotMatch(text, /Tallahassee|not because|94%|Staff 80/i);
  });

  it('attachWhyWeChaseToPlayers ranks by priorityScore without reordering', () => {
    const players = [
      { slug: 'b', name: 'Bee Kid', position: 'WR', priorityScore: 40 },
      {
        slug: 'a',
        name: 'Ace Kid',
        position: 'CB',
        priorityScore: 90,
        ufRpmPct: 70,
        hotLanes: { staffHeat: 80 },
      },
      {
        slug: 'c',
        name: 'Cee Kid',
        position: 'EDGE',
        priorityScore: 55,
        hotLanes: { positionalNeed: 90, staffHeat: 70 },
      },
    ];
    const out = brief.attachWhyWeChaseToPlayers(players);
    assert.equal(out[0].slug, 'b');
    assert.equal(out[1].slug, 'a');
    assert.equal(out[2].slug, 'c');
    assert.equal(out[1].chaseRank, 1);
    assert.equal(out[2].chaseRank, 2);
    assert.equal(out[0].chaseRank, 3);
    assert.ok(out[1].whyWeChase);
  });

  it('resolveWhyWeChase prefers override text', () => {
    store.upsertOverride('test-override-kid', 'Manual override for Test.', {
      updatedBy: 'test',
    });
    const text = brief.resolveWhyWeChase(
      { slug: 'test-override-kid', name: 'Test Override Kid', position: 'WR' },
      { chaseRank: 9 }
    );
    assert.equal(text, 'Manual override for Test.');
    store.clearOverride('test-override-kid');
  });
});
