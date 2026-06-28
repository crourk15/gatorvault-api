const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isPlaceholderSkinny,
  hasMeaningfulOn3Fields,
  assessOn3Intel,
} = require('../../lib/recruiting-intel-quality');

test('isPlaceholderSkinny rejects generated offer copy and empty text', () => {
  assert.equal(isPlaceholderSkinny(''), true);
  assert.equal(isPlaceholderSkinny('Kaleb Exume holds a Florida offer.'), true);
  assert.equal(isPlaceholderSkinny('Florida HS pipeline'), true);
  assert.equal(
    isPlaceholderSkinny('5★ WR committed to Texas; official visit to UF June 11–13.'),
    false
  );
});

test('hasMeaningfulOn3Fields requires on3Id plus rating, measurables, or school', () => {
  assert.equal(hasMeaningfulOn3Fields({}, {}), false);
  assert.equal(hasMeaningfulOn3Fields({ on3Id: 1 }, {}), false);
  assert.equal(hasMeaningfulOn3Fields({ on3Id: 1, stars: 4, pos: 'WR' }, {}), true);
  assert.equal(
    hasMeaningfulOn3Fields({ on3Id: 1, school: 'Brother Martin, LA' }, {}),
    true
  );
});

test('assessOn3Intel blocks missing slug and thin profiles', () => {
  assert.equal(assessOn3Intel({ on3: {}, recruitSlug: null }).ok, false);
  assert.equal(assessOn3Intel({ on3: {}, recruitSlug: 'foo' }).reason, 'no_on3_id');
  assert.equal(
    assessOn3Intel({ on3: { on3Id: 99 }, recruitSlug: 'foo' }).reason,
    'thin_on3_profile'
  );
  assert.equal(
    assessOn3Intel({
      on3: { on3Id: 243862, stars: 5, pos: 'WR', on3ProfileUrl: 'https://on3.test/' },
      recruitSlug: 'easton-royal-243862',
    }).ok,
    true
  );
});
