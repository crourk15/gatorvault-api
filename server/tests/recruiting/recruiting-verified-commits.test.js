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

test('verified 2027 UF commits are only tre-geathers, jaydee-lane, ellis-mcgaskin, aaron-mcwilliams', () => {
  const verified = ['tre-geathers', 'jaydee-lane', 'ellis-mcgaskin', 'aaron-mcwilliams'];
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

test('isFloridaCommit uses status committed for hub classes in JSON mode', () => {
  const originalSupabase = process.env.SUPABASE_URL;
  delete process.env.SUPABASE_URL;
  delete require.cache[require.resolve('../../lib/recruiting-store')];
  const jsonStore = require('../../lib/recruiting-store');

  assert.equal(
    jsonStore.isFloridaCommit({ slug: 'ellis-mcgaskin', classYear: 2027, status: 'committed', committedTo: 'Florida' }),
    true
  );
  assert.equal(
    jsonStore.isFloridaCommit({
      slug: 'maxwell-hiller',
      classYear: 2027,
      status: 'committed',
      committedTo: 'Florida',
      protected: true,
    }),
    true
  );
  assert.equal(
    jsonStore.isFloridaCommit({ slug: 'maxwell-hiller', classYear: 2027, status: 'committed', committedTo: 'Florida' }),
    true
  );
  assert.equal(
    jsonStore.isFloridaCommit({ slug: 'maxwell-hiller', classYear: 2027, status: 'target', committedTo: null }),
    false
  );

  if (originalSupabase) process.env.SUPABASE_URL = originalSupabase;
  else delete process.env.SUPABASE_URL;
  delete require.cache[require.resolve('../../lib/recruiting-store')];
});

test('getHubCommits returns only verified Florida commits from DATABASE_URL when Supabase client is absent', async () => {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
  if (!process.env.DATABASE_URL) {
    console.log('skip: DATABASE_URL not configured');
    return;
  }
  delete process.env.SUPABASE_URL;
  delete require.cache[require.resolve('../../lib/recruiting-store')];
  delete require.cache[require.resolve('../../lib/recruiting-verified-commits')];
  const jsonStore = require('../../lib/recruiting-store');
  const { isVerifiedHubCommit } = require('../../lib/recruiting-verified-commits');
  const commits = await jsonStore.getHubCommits(2027);
  assert.ok(Array.isArray(commits));
  for (const player of commits) {
    assert.equal(String(player.committedTo || '').toLowerCase(), 'florida');
    assert.equal(isVerifiedHubCommit(player), true, player.slug);
  }
  assert.equal(
    commits.some((p) => String(p.slug || '').toLowerCase() === 'easton-royal'),
    false,
    'easton-royal must not appear as a UF commit'
  );
  delete require.cache[require.resolve('../../lib/recruiting-store')];
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

test('countVerifiedHubCommits returns 4 for canonical store slugs', () => {
  const count = countVerifiedHubCommits(
    [
      { slug: 'tre-geathers', classYear: 2027, status: 'commit', committedTo: 'Florida' },
      { slug: 'jaydee-lane', classYear: 2027, status: 'committed', committedTo: 'Florida' },
      { slug: 'ellis-mcgaskin', classYear: 2027, status: 'committed', committedTo: 'Florida' },
      { slug: 'aaron-mcwilliams', classYear: 2027, status: 'committed', committedTo: 'Florida' },
      { slug: 'aamaury-fountain', classYear: 2027, status: 'committed', committedTo: 'Florida' },
    ],
    2027
  );
  assert.equal(count, 4);
});

test('demoteUnverifiedHubCommit preserves Texas commit for protected flip target easton-royal', () => {
  const demoted = demoteUnverifiedHubCommit({
    slug: 'easton-royal',
    classYear: 2027,
    status: 'committed',
    committedTo: 'Florida',
    category: 'recruit',
    protected: true,
  });
  assert.equal(demoted.status, 'uncommitted');
  assert.equal(demoted.committedTo, 'Texas');
  assert.equal(demoted.category, 'target');
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
