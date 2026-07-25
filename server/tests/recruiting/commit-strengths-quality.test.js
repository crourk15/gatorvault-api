const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isCompositeBio,
  isVerifiedScoutingTrait,
  verifiedStrengthsList,
  buildSyntheticBreakdown,
} = require('../../lib/recruiting-intel-quality');

const ARMANI_BIO =
  'Armani Strong is a 4-star WR · listed at 6-1 / 180 · from Chaminade-Madonna Prep, FL · #209 nationally, #31 at WR, #28 in state.';

test('composite On3 bio is not a scouting strength', () => {
  assert.equal(isCompositeBio(ARMANI_BIO), true);
  assert.equal(isVerifiedScoutingTrait(ARMANI_BIO, 'Armani Strong'), false);
  assert.equal(
    verifiedStrengthsList({ name: 'Armani Strong', strengths: [ARMANI_BIO] }),
    null
  );
});

test('player last name Strong cannot fake trait keyword', () => {
  assert.equal(
    isVerifiedScoutingTrait('Armani Strong committed to Florida.', 'Armani Strong'),
    false
  );
  assert.equal(
    isVerifiedScoutingTrait('Elite route runner with plus ball skills.', 'Armani Strong'),
    true
  );
});

test('synthetic breakdown does not invent strengths from rank dump', () => {
  const bd = buildSyntheticBreakdown({
    slug: 'armani-strong',
    name: 'Armani Strong',
    pos: 'WR',
    stars: 4,
    htWt: '6-1 / 180',
    school: 'Chaminade-Madonna Prep, FL',
    natlRank: 209,
    posRank: 31,
    stateRank: 28,
    commitDate: '2026-06-28',
    status: 'committed',
  });
  assert.ok(bd);
  assert.deepEqual(bd.strengths, []);
});
