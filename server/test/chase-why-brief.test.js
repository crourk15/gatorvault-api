'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const brief = require('../lib/chase-why-brief');
const store = require('../lib/chase-why-store');

describe('chase-why-brief intel nuggets', () => {
  it('Vickers #1 — owns the board, no hometown disclaimer', () => {
    const text = brief.generateWhyWeChase(
      {
        slug: 'izayah-vickers',
        name: 'Izayah Vickers',
        position: 'CB',
        ufRpmPct: 94,
        hotLanes: { staffHeat: 80, mustGetFit: 70, positionalNeed: 88 },
        hotBadges: { staffAssigned: true, inState: true },
      },
      { chaseRank: 1 }
    );
    assert.match(text, /owns this CB|staff is locked on Vickers/i);
    assert.doesNotMatch(text, /Tallahassee|not because|filler|mid-board noise/i);
  });

  it('Henderson — EDGE room + in-state pass-rush + FSU/Georgia', () => {
    const c = brief.composeWhyWeChase(
      {
        slug: 'tristian-henderson',
        name: 'Tristian Henderson',
        position: 'EDGE',
        stars: 4,
        ufRpmPct: 18,
        hotLanes: { staffHeat: 75, mustGetFit: 70, positionalNeed: 92, geoPipeline: 90 },
        hotBadges: { inState: true, staffAssigned: true },
        competingSchools: [
          { name: 'Florida State', pct: 34 },
          { name: 'Georgia', pct: 28 },
        ],
        on3Lead: 'FSU',
      },
      { chaseRank: 13 }
    );
    assert.match(c.text, /EDGE room is a real gap/i);
    assert.match(c.text, /in-state pass-rush priority/i);
    assert.match(c.text, /FSU\/Georgia|board still wide open/i);
    assert.ok(c.builtFrom.includes('EDGE need'));
    assert.ok(c.builtFrom.includes('in-state'));
  });

  it('Asher — five-star fit chase with Miami lead + FAU visit', () => {
    const c = brief.composeWhyWeChase(
      {
        slug: 'asher-ghioto',
        name: 'Asher Ghioto',
        position: 'EDGE',
        stars: 5,
        ufRpmPct: 15,
        nationalRank: 12,
        fitScore: 90,
        hotLanes: { staffHeat: 60, mustGetFit: 90, positionalNeed: 90 },
        hotBadges: { inState: true, staffAssigned: true },
        competingSchools: [{ name: 'Miami', pct: 42 }],
        on3Lead: 'Miami',
        visitLabels: ['Expected FAU visit · Sep 5'],
      },
      { chaseRank: 2 }
    );
    assert.match(c.text, /Five-star EDGE with elite scheme fit/i);
    assert.match(c.text, /Miami leads/i);
    assert.match(c.text, /FAU visit keeps the process live/i);
    assert.doesNotMatch(c.text, /filler|mid-board noise/i);
  });

  it('Alexander — nationally ranked LB + quiet staff push top-10', () => {
    const c = brief.composeWhyWeChase(
      {
        slug: 'andre-alexander',
        name: 'Andre Alexander',
        position: 'LB',
        stars: 4,
        nationalRank: 72,
        ufRpmPct: 26,
        hotLanes: { staffHeat: 70, mustGetFit: 65, positionalNeed: 88 },
        hotBadges: { staffAssigned: true, quietChase: true },
      },
      { chaseRank: 10 }
    );
    assert.match(c.text, /Nationally ranked LB with staff already assigned/i);
    assert.match(c.text, /quiet staff push|room need/i);
    assert.match(c.text, /top-10 chase/i);
  });

  it('Evans late board — interior line Fit vs Ole Miss', () => {
    const c = brief.composeWhyWeChase(
      {
        slug: 'pj-evans',
        name: 'PJ Evans',
        position: 'IOL',
        stars: 3,
        ufRpmPct: 34,
        fitScore: 80,
        hotLanes: { staffHeat: 40, mustGetFit: 80, positionalNeed: 70 },
        competingSchools: [{ name: 'Ole Miss', pct: 40 }],
        on3Lead: 'Ole Miss',
      },
      { chaseRank: 43 }
    );
    assert.match(c.text, /Interior line with real trench value/i);
    assert.match(c.text, /Ole Miss sits ahead/i);
    assert.match(c.text, /not a top-target yet/i);
  });

  it('attachWhyWeChaseToPlayers includes builtFrom and ranks by priority', () => {
    const out = brief.attachWhyWeChaseToPlayers([
      { slug: 'b', name: 'Bee Kid', position: 'WR', priorityScore: 40 },
      {
        slug: 'a',
        name: 'Ace Kid',
        position: 'CB',
        priorityScore: 90,
        ufRpmPct: 70,
        hotLanes: { staffHeat: 80 },
      },
    ]);
    assert.equal(out[1].chaseRank, 1);
    assert.ok(out[1].whyWeChase);
    assert.ok('whyWeChaseBuiltFrom' in out[1]);
  });


  it('handwritten override beats generator for Vickers', () => {
    const text = brief.resolveWhyWeChase(
      {
        slug: 'izayah-vickers',
        name: 'Izayah Vickers',
        position: 'CB',
        ufRpmPct: 94,
        hotLanes: { staffHeat: 80, positionalNeed: 88 },
        hotBadges: { staffAssigned: true },
      },
      { chaseRank: 1 }
    ).text;
    assert.match(text, /Quiet CB Florida already leads|secondary still needs/i);
    assert.doesNotMatch(text, /sitting at the top of the chase|staff is locked on Vickers/i);
  });

  it('resolveWhyWeChase prefers override text', () => {
    store.upsertOverride('test-override-kid', 'Manual override for Test.', {
      updatedBy: 'test',
    });
    const resolved = brief.resolveWhyWeChase(
      { slug: 'test-override-kid', name: 'Test Override Kid', position: 'WR' },
      { chaseRank: 9 }
    );
    assert.equal(resolved.text, 'Manual override for Test.');
    assert.equal(resolved.overridden, true);
    store.clearOverride('test-override-kid');
  });
});
