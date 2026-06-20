const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isVerifiedHubCommit,
  demoteUnverifiedHubCommit,
  applyVerifiedHubCommit,
  validateVerifiedCommits,
  countVerifiedHubCommits,
} = require('../../lib/recruiting-verified-commits');
const store = require('../../lib/recruiting-store');

test('verified 2027 UF commits are only tre-geathers, jaydee-lane, ellis-mcgaskin', () => {
  const verified = ['tre-geathers', 'jaydee-lane', 'ellis-mcgaskin'];
  for (const slug of verified) {
    assert.equal(
      isVerifiedHubCommit({ slug, classYear: 2027, status: 'committed', committedTo: 'Florida' }),
      true,
      slug
    );
  }
  assert.equal(
    isVerifiedHubCommit({ slug: 'aamaury-fountain', classYear: 2027, status: 'committed', committedTo: 'Florida' }),
    false
  );
});

test('isFloridaCommit respects verified allowlist for 2027', () => {
  assert.equal(
    store.isFloridaCommit({ slug: 'ellis-mcgaskin', classYear: 2027, status: 'committed', committedTo: 'Florida' }),
    true
  );
  assert.equal(
    store.isFloridaCommit({
      slug: 'maxwell-hiller',
      classYear: 2027,
      status: 'committed',
      committedTo: 'Florida',
      protected: true,
    }),
    true
  );
  assert.equal(
    store.isFloridaCommit({ slug: 'maxwell-hiller', classYear: 2027, status: 'committed', committedTo: 'Florida' }),
    false
  );
});

test('demoteUnverifiedHubCommit clears false commits', () => {
  const demoted = demoteUnverifiedHubCommit({
    slug: 'aamaury-fountain',
    classYear: 2027,
    status: 'committed',
    committedTo: 'Florida',
    category: 'recruit',
  });
  assert.equal(demoted.status, 'uncommitted');
  assert.equal(demoted.committedTo, null);
  assert.equal(demoted.category, 'target');
});

test('validateVerifiedCommits flags unverified rows', () => {
  const errors = validateVerifiedCommits([
    { slug: 'tre-geathers', classYear: 2027, status: 'committed', committedTo: 'Florida' },
    { slug: 'fake-commit', classYear: 2027, status: 'committed', committedTo: 'Florida' },
  ]);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].slug, 'fake-commit');
});

test('countVerifiedHubCommits returns 3 for canonical store slugs', () => {
  const count = countVerifiedHubCommits(
    [
      { slug: 'tre-geathers', classYear: 2027, status: 'commit', committedTo: 'Florida' },
      { slug: 'jaydee-lane', classYear: 2027, status: 'committed', committedTo: 'Florida' },
      { slug: 'ellis-mcgaskin', classYear: 2027, status: 'committed', committedTo: 'Florida' },
      { slug: 'aamaury-fountain', classYear: 2027, status: 'committed', committedTo: 'Florida' },
    ],
    2027
  );
  assert.equal(count, 3);
});

test('applyVerifiedHubCommit restores demoted verified slug', () => {
  const restored = applyVerifiedHubCommit({
    slug: 'jaydee-lane',
    classYear: 2027,
    status: 'uncommitted',
    committedTo: null,
    category: 'target',
  });
  assert.equal(restored.status, 'committed');
  assert.equal(restored.committedTo, 'Florida');
  assert.equal(restored.category, 'recruit');
});
