const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isFloridaSchool,
  isCommittedElsewhere,
  isActiveUfTarget,
  filterActiveUfTargets,
} = require('../../lib/recruiting-target-filters');
const { filterAllowlistedTargets } = require('../../lib/recruiting-target-allowlist');

test('isFloridaSchool matches Gators variants', () => {
  assert.equal(isFloridaSchool('Florida'), true);
  assert.equal(isFloridaSchool('Florida Gators'), true);
  assert.equal(isFloridaSchool('Miami'), false);
});

test('isCommittedElsewhere excludes non-UF commits', () => {
  assert.equal(isCommittedElsewhere({ committedTo: 'Miami' }), true);
  assert.equal(isCommittedElsewhere({ committedTo: 'Texas' }), true);
  assert.equal(isCommittedElsewhere({ committedTo: 'Florida' }), false);
  assert.equal(isCommittedElsewhere({ committedTo: null }), false);
});

test('isActiveUfTarget excludes UF commits and elsewhere commits', () => {
  assert.equal(isActiveUfTarget({ committedTo: 'Florida', status: 'committed' }), false);
  assert.equal(isActiveUfTarget({ committedTo: 'Miami', status: 'committed' }), false);
  assert.equal(isActiveUfTarget({ committedTo: 'Texas' }), false);
  assert.equal(isActiveUfTarget({ committedTo: null, status: 'uncommitted' }), true);
});

test('filterAllowlistedTargets drops Hyppolite-style Miami commits', () => {
  const targets = filterAllowlistedTargets(
    [
      { slug: 'andre-hyppolite', name: 'Andre Hyppolite', classYear: 2027, committedTo: 'Miami' },
      { slug: 'jalen-brewster', name: 'Jalen Brewster', classYear: 2027, committedTo: null },
      { slug: 'easton-royal', name: 'Easton Royal', classYear: 2027, committedTo: 'Texas' },
    ],
    2027
  );
  const slugs = targets.map((p) => p.slug);
  assert.ok(!slugs.includes('andre-hyppolite'));
  assert.ok(!slugs.includes('easton-royal'));
  assert.ok(slugs.includes('jalen-brewster'));
});

test('filterActiveUfTargets', () => {
  const out = filterActiveUfTargets([
    { committedTo: 'Florida' },
    { committedTo: 'Miami' },
    { committedTo: null },
  ]);
  assert.equal(out.length, 1);
});
