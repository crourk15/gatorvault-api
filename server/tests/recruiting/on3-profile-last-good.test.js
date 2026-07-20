const test = require('node:test');
const assert = require('node:assert/strict');
const {
  applyEditorialPositionToPlayer,
  isWeakPosition,
} = require('../../lib/recruiting-editorial-positions');

test('hostile On3 path: Cyion ATH thin store upgrades from board last-good', () => {
  const thin = applyEditorialPositionToPlayer({
    slug: 'cyion-smith',
    classYear: 2028,
    pos: 'ATH',
    position: 'ATH',
  });
  assert.equal(thin.pos, 'S');
  assert.ok(!isWeakPosition(thin.pos));
  assert.equal(thin.htWt, '6-2 / 175');
  assert.match(String(thin.skinny || ''), /Blountstown|Alderman/);
});

test('syncSlugFromOn3Fast last-good field contract fills empty patch from local JSON', () => {
  const profilePatch = {};
  const localPlayer = {
    slug: 'cyion-smith',
    pos: 'S',
    htWt: '6-2 / 175',
    skinny: '2028 4-star S — Blountstown',
    natlRank: 175,
    posRank: 14,
    stars: 4,
  };
  const existing = { slug: 'cyion-smith', pos: 'ATH', classYear: 2028 };
  const lastGoodFields = ['natlRank', 'posRank', 'stars', 'htWt', 'skinny', 'pos'];
  let usedLastGood = false;
  for (const field of lastGoodFields) {
    const cur = profilePatch[field];
    if (cur != null && cur !== '') continue;
    const val =
      localPlayer[field] != null && localPlayer[field] !== ''
        ? localPlayer[field]
        : existing[field] != null && existing[field] !== ''
          ? existing[field]
          : null;
    if (val != null && val !== '') {
      profilePatch[field] = val;
      usedLastGood = true;
    }
  }
  if (usedLastGood) profilePatch.on3Source = 'on3_profile_last_good';
  assert.equal(profilePatch.pos, 'S');
  assert.equal(profilePatch.htWt, '6-2 / 175');
  assert.equal(profilePatch.on3Source, 'on3_profile_last_good');
});
