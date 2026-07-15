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
  assert.equal(
    isActiveUfTarget({ slug: 'raheem-floyd', committedTo: null, status: 'uncommitted', classYear: 2028 }),
    false,
    'verified UF commit slug never counts as an active target'
  );
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

test('filterAllowlistedTargets keeps 2027 live UF board rows beyond Charles allowlist', () => {
  const targets = filterAllowlistedTargets(
    [
      {
        slug: 'seth-williams',
        name: 'Seth Williams',
        classYear: 2027,
        committedTo: null,
        boardSource: '247-uf-board-sync',
        category: 'target',
        status: 'uncommitted',
      },
      {
        slug: 'random-not-on-board',
        name: 'Random Prospect',
        classYear: 2027,
        committedTo: null,
        category: 'target',
        status: 'uncommitted',
      },
    ],
    2027
  );
  const slugs = targets.map((p) => p.slug);
  assert.ok(slugs.includes('seth-williams'));
  assert.ok(!slugs.includes('random-not-on-board'));
});

test('filterActiveUfTargets', () => {
  const out = filterActiveUfTargets([
    { committedTo: 'Florida' },
    { committedTo: 'Miami' },
    { committedTo: null },
  ]);
  assert.equal(out.length, 1);
});
