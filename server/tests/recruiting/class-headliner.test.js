'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const {
  pickClassHeadlinerId,
  healCommitHeadlinerBadges,
} = require('../../lib/pick-class-headliner');

describe('2028 class headliner is highest rank', () => {
  it('picks Samuel Bailey over Armani Strong', () => {
    const commits = [
      { id: 'armani-strong', name: 'Armani Strong', nationalRank: 215, rating: 90.2, headliner: true },
      { id: 'samuel-bailey', name: 'Samuel Bailey', nationalRank: 49, rating: 92.8, headliner: false },
      { id: 'cyion-smith', name: 'Cyion Smith', nationalRank: 250, rating: 89.5 },
    ];
    assert.equal(pickClassHeadlinerId(commits), 'samuel-bailey');
  });

  it('reads #natl from commit-card metaLine when rank fields are missing', () => {
    assert.equal(
      pickClassHeadlinerId([
        { id: 'armani-strong', metaLine: '4★ WR · Miami, FL · #215 natl' },
        { id: 'samuel-bailey', metaLine: '4★ OT · Huntsville, AL · #49 natl' },
      ]),
      'samuel-bailey'
    );
  });

  it('moves Headliner badge off Armani onto Bailey', () => {
    const healed = healCommitHeadlinerBadges([
      {
        id: 'samuel-bailey',
        statusBadge: 'Committed',
        skinny: 'Samuel Bailey committed to Florida.',
        metaLine: '4★ OT · #49 natl',
      },
      {
        id: 'armani-strong',
        statusBadge: 'Headliner',
        skinny: 'Armani Strong committed to Florida. Listed at 6-1 / 180 · Class headliner.',
        metaLine: '4★ WR · #215 natl',
      },
    ]);
    const bailey = healed.find((r) => r.id === 'samuel-bailey');
    const armani = healed.find((r) => r.id === 'armani-strong');
    assert.equal(bailey.statusBadge, 'Headliner');
    assert.match(String(bailey.skinny), /Class headliner/i);
    assert.equal(armani.statusBadge, 'Committed');
    assert.doesNotMatch(String(armani.skinny), /Class headliner/i);
  });

  it('does not restamp pre-2028 class snapshots', () => {
    const items = [
      { id: 'someone', statusBadge: 'Headliner', nationalRank: 200 },
      { id: 'better', statusBadge: 'Committed', nationalRank: 10 },
    ];
    assert.equal(healCommitHeadlinerBadges(items, 2027), items);
  });
});
