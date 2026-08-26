'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  rankEliteHomeNowLines,
  eliteHomeNowScore,
} = require('../../lib/elite-home-now');

test('elite NOW prefers Florida visits over offer spam and thin class metrics', () => {
  const ranked = rankEliteHomeNowLines(
    [
      'Blue chip % at 100%',
      '1 commits locked for 2028',
      'Antijuan Wilkes Jr. — Florida offer',
      'Prince Che — Florida offer',
      'Derrell Hines Jr. — Florida offer',
      'Tranard Roberts — unofficial visit · Florida',
      '2027 class trending nationally — UF at #8',
      '26 commits locked for 2027',
      'Nate Dollard — Offer from Texas A&M Aggies',
    ],
    6
  );
  assert.equal(ranked[0], 'Tranard Roberts — unofficial visit · Florida');
  assert.ok(ranked.includes('2027 class trending nationally — UF at #8'));
  assert.ok(ranked.includes('26 commits locked for 2027'));
  assert.ok(!ranked.some((s) => /Blue chip % at 100%|1 commits locked/i.test(s)));
  assert.ok(ranked.filter((s) => /Florida offer/i.test(s)).length <= 2);
  assert.ok(eliteHomeNowScore('Tranard Roberts — unofficial visit · Florida') >
    eliteHomeNowScore('Antijuan Wilkes Jr. — Florida offer'));
});
