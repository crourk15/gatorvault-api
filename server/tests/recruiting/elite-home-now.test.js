'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  rankEliteHomeNowLines,
  eliteHomeNowScore,
  buildHomeNowGameStory,
  isThinFloridaProcessLine,
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
  assert.equal(ranked.filter((s) => /class trending|commits locked|Blue chip %/i.test(s)).length, 1);
  assert.ok(!ranked.some((s) => /Blue chip % at 100%|1 commits locked/i.test(s)));
  assert.ok(ranked.filter((s) => /Florida offer/i.test(s)).length <= 2);
  assert.ok(eliteHomeNowScore('Tranard Roberts — unofficial visit · Florida') >
    eliteHomeNowScore('Antijuan Wilkes Jr. — Florida offer'));
});

test('this-week visit and game week outrank frozen class metrics', () => {
  const ranked = rankEliteHomeNowLines(
    [
      '2027 class trending nationally — UF at #8',
      '26 commits locked for 2027',
      'Blue chip % at 65%',
      'Cyion Smith — Visit scheduled (Saturday)',
      'Game Week — Ole Miss in the Swamp · ABC',
      'Hudson West — Florida process.',
    ],
    6
  );
  assert.equal(ranked[0], 'Game Week — Ole Miss in the Swamp · ABC');
  assert.ok(ranked.includes('Cyion Smith — Visit scheduled (Saturday)'));
  assert.ok(!ranked.some((s) => /Florida process/i.test(s)));
  assert.equal(ranked.filter((s) => /class trending|commits locked|Blue chip %/i.test(s)).length, 1);
  assert.ok(eliteHomeNowScore('Cyion Smith — Visit scheduled (Saturday)') >
    eliteHomeNowScore('2027 class trending nationally — UF at #8'));
  assert.ok(isThinFloridaProcessLine('Hudson West — Florida process.'));
});

test('buildHomeNowGameStory stamps Ole Miss Game Week from the slate', () => {
  const line = buildHomeNowGameStory(new Date('2026-09-21T18:00:00.000Z'));
  assert.equal(line, 'Game Week — Ole Miss in the Swamp · ABC');
  assert.equal(buildHomeNowGameStory(new Date('2026-07-15T16:00:00.000Z')), null);
});
