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
  assert.equal(
    isActiveUfTarget({ slug: 'adryan-cole', committedTo: null, status: 'uncommitted', category: 'target' }),
    false,
    'forced elsewhere-commit (Cole → Georgia) never counts as an active target'
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

test('filterAllowlistedTargets keeps Brewster flip watch after Texas Tech commit', () => {
  const { FLIP_WATCH_2027 } = require('../../lib/recruiting-target-allowlist');
  assert.ok(FLIP_WATCH_2027.includes('jalen-brewster'));
  const targets = filterAllowlistedTargets(
    [
      {
        slug: 'jalen-brewster',
        name: 'Jalen Brewster',
        classYear: 2027,
        category: 'target',
        status: 'committed',
        committedTo: 'Texas Tech',
        flipWatch: true,
      },
      {
        slug: 'adryan-cole',
        name: 'Adryan Cole',
        classYear: 2027,
        category: 'target',
        status: 'committed',
        committedTo: 'Georgia',
      },
      {
        slug: 'elijah-guertin',
        name: 'Elijah Guertin',
        classYear: 2027,
        category: 'target',
        status: 'committed',
        committedTo: 'Penn State',
      },
    ],
    2027
  );
  const slugs = targets.map((p) => p.slug);
  assert.deepEqual(slugs, ['jalen-brewster']);
});

test('getAllowlistSet(2027) does not merge Lab soft-visit promotions', () => {
  const path = require('path');
  const fs = require('fs');
  const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-lab-2027-'));
  const prev = process.env.GV_LAB_PROMOTIONS_PATH;
  process.env.GV_LAB_PROMOTIONS_PATH = path.join(tmp, 'lab-promotions.json');
  delete require.cache[require.resolve('../../lib/lab-promotions-store')];
  delete require.cache[require.resolve('../../lib/recruiting-target-allowlist')];
  const promotions = require('../../lib/lab-promotions-store');
  promotions.upsertStage('lab', {
    slug: 'soft-visit-noise',
    name: 'Soft Visit Noise',
    classYear: 2027,
    reasons: ['florida_visit'],
    sources: ['visit_log'],
  });
  const allowlist = require('../../lib/recruiting-target-allowlist');
  assert.equal(allowlist.getAllowlistSet(2027).has('soft-visit-noise'), false);
  assert.equal(allowlist.getAllowlistSet(2027).has('jalen-brewster'), true);
  if (prev == null) delete process.env.GV_LAB_PROMOTIONS_PATH;
  else process.env.GV_LAB_PROMOTIONS_PATH = prev;
  delete require.cache[require.resolve('../../lib/lab-promotions-store')];
  delete require.cache[require.resolve('../../lib/recruiting-target-allowlist')];
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('filterAllowlistedTargets drops 2027 247 offer-list rows not on hunt allowlist', () => {
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
        slug: 'andre-hyppolite',
        name: 'Andre Hyppolite',
        classYear: 2027,
        committedTo: null,
        boardSource: '247-uf-board-sync',
        category: 'target',
        status: 'uncommitted',
      },
      {
        slug: 'tranard-roberts',
        name: 'Tranard Roberts',
        classYear: 2027,
        committedTo: null,
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
  assert.deepEqual(slugs, ['tranard-roberts']);
});

test('isActiveUfTarget excludes forced Miami/Notre Dame commits even when store looks open', () => {
  assert.equal(
    isActiveUfTarget({ slug: 'andre-hyppolite', committedTo: null, status: 'uncommitted', category: 'target' }),
    false,
    'Hyppolite → Miami must never count as an active UF target'
  );
  assert.equal(
    isActiveUfTarget({ slug: 'ace-alston', committedTo: null, status: 'uncommitted', category: 'target' }),
    false,
    'Alston → Notre Dame must never count as an active UF target'
  );
  assert.equal(
    isActiveUfTarget({ slug: 'monshun-sales', committedTo: null, status: 'uncommitted', category: 'target' }),
    false,
    'Sales → Indiana must never count as an active UF target'
  );
});

test('filterActiveUfTargets', () => {
  const out = filterActiveUfTargets([
    { committedTo: 'Florida' },
    { committedTo: 'Miami' },
    { committedTo: null },
  ]);
  assert.equal(out.length, 1);
});
