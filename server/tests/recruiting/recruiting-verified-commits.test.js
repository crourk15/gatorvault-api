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

test('getHubCommits returns all Florida commits for hub class years', async () => {
  delete process.env.SUPABASE_URL;
  delete process.env.DATABASE_URL;
  delete require.cache[require.resolve('../../lib/recruiting-store')];
  const jsonStore = require('../../lib/recruiting-store');
  const commits = await jsonStore.getHubCommits(2027);
  assert.ok(Array.isArray(commits));
  assert.ok(commits.length >= 20, `expected full 2027 class, got ${commits.length}`);
  for (const player of commits) {
    assert.equal(String(player.committedTo || '').toLowerCase(), 'florida');
    assert.ok(
      player.on3Source === 'on3-board-sync' || player.protected === true,
      `${player.slug} should be an official On3 board commit`
    );
  }
  assert.equal(
    commits.some((p) => String(p.slug || '').toLowerCase() === 'easton-royal'),
    false,
    'easton-royal must not appear as a UF commit'
  );
  assert.equal(
    commits.some((p) => String(p.slug || '').toLowerCase() === 'maxwell-hiller'),
    true,
    'maxwell-hiller and other UF commits should appear'
  );
  delete require.cache[require.resolve('../../lib/recruiting-store')];
});

test('getHubHsCommits 2026 excludes portal signees', async () => {
  delete process.env.SUPABASE_URL;
  delete process.env.DATABASE_URL;
  delete require.cache[require.resolve('../../lib/recruiting-store')];
  delete require.cache[require.resolve('../../lib/on3-snapshot-commits')];
  const jsonStore = require('../../lib/recruiting-store');
  const all = await jsonStore.getHubCommits(2026);
  const hs = await jsonStore.getHubHsCommits(2026);
  assert.ok(hs.length > 0 && hs.length < all.length, 'HS commits should be a subset of all hub commits');
  assert.ok(hs.every((p) => String(p.category).toLowerCase() !== 'portal'));
  delete require.cache[require.resolve('../../lib/recruiting-store')];
  delete require.cache[require.resolve('../../lib/on3-snapshot-commits')];
});

test('getHubCommits 2026 merges On3 snapshot board commits', async () => {
  delete process.env.SUPABASE_URL;
  delete process.env.DATABASE_URL;
  delete require.cache[require.resolve('../../lib/recruiting-store')];
  delete require.cache[require.resolve('../../lib/on3-snapshot-commits')];
  const jsonStore = require('../../lib/recruiting-store');
  const { countSnapshotHubCommits } = require('../../lib/on3-snapshot-commits');
  const commits = await jsonStore.getHubCommits(2026);
  const expected = countSnapshotHubCommits(2026);
  assert.ok(expected > 0, 'snapshot should define 2026 commits');
  assert.ok(commits.length >= expected - 5 && commits.length <= expected,
    `2026 hub commits should track On3 snapshot (${commits.length} vs ${expected})`);
  for (const player of commits) {
    assert.ok(
      player.on3Source === 'on3-board-sync' || player.on3Id,
      `${player.slug} should be an On3 board commit`
    );
  }
  delete require.cache[require.resolve('../../lib/recruiting-store')];
  delete require.cache[require.resolve('../../lib/on3-snapshot-commits')];
});

test('demoteUnverifiedHubCommit preserves protected on3 board sync commits', () => {
  const kept = demoteUnverifiedHubCommit({
    slug: 'elijah-hutcheson',
    classYear: 2027,
    status: 'committed',
    committedTo: 'Florida',
    category: 'recruit',
    on3Source: 'on3-board-sync',
    protected: true,
  });
  assert.equal(kept.status, 'committed');
  assert.equal(kept.committedTo, 'Florida');
});

test('demoteUnverifiedHubCommit clears false UF commit on allowlist on3-board-sync target', () => {
  const demoted = demoteUnverifiedHubCommit({
    slug: 'kyren-caldwell',
    classYear: 2027,
    status: 'committed',
    committedTo: 'Florida',
    category: 'recruit',
    on3Source: 'on3-board-sync',
  });
  assert.equal(demoted.status, 'uncommitted');
  assert.equal(demoted.committedTo, null);
  assert.equal(demoted.category, 'target');
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

test('getHubCommits ignores stale store rows when On3 snapshot defines the class board', async () => {
  delete process.env.SUPABASE_URL;
  delete process.env.DATABASE_URL;
  delete require.cache[require.resolve('../../lib/recruiting-store')];
  delete require.cache[require.resolve('../../lib/on3-snapshot-commits')];
  const jsonStore = require('../../lib/recruiting-store');
  const { countSnapshotHubCommits } = require('../../lib/on3-snapshot-commits');
  const expected = countSnapshotHubCommits(2027);
  assert.ok(expected > 0, 'snapshot should define 2027 commits');

  const originalGetAll = jsonStore.getAllPlayers;
  jsonStore.getAllPlayers = async () => {
    const base = await originalGetAll();
    const bloated = [];
    for (let i = 0; i < 200; i += 1) {
      bloated.push({
        slug: `stale-fake-commit-${i}`,
        name: `Stale Fake ${i}`,
        classYear: 2027,
        status: 'committed',
        committedTo: 'Florida',
        category: 'recruit',
        on3Id: String(900000 + i),
        stars: 3,
      });
    }
    return base.concat(bloated);
  };

  const commits = await jsonStore.getHubCommits(2027);
  assert.equal(
    commits.length,
    expected,
    `bloated store must not inflate 2027 commits (${commits.length} vs ${expected})`
  );

  jsonStore.getAllPlayers = originalGetAll;
  delete require.cache[require.resolve('../../lib/recruiting-store')];
  delete require.cache[require.resolve('../../lib/on3-snapshot-commits')];
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

test('applyVerifiedHubCommit repairs wrong-year verified commit (Floyd 2028 drift)', () => {
  const restored = applyVerifiedHubCommit({
    slug: 'raheem-floyd',
    classYear: 2028,
    status: 'uncommitted',
    committedTo: null,
    category: 'target',
  });
  assert.equal(restored.classYear, 2027);
  assert.equal(restored.status, 'committed');
  assert.equal(restored.committedTo, 'Florida');
  assert.equal(restored.category, 'recruit');
});
