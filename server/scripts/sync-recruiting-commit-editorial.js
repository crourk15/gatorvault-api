#!/usr/bin/env node
/**
 * Editorial commit sync: Aaron McWilliams (UF 2027) + Easton Royal (Texas, not UF).
 * Run against production DATABASE_URL / Supabase before or after deploy.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const store = require('../lib/recruiting-store');
const { restoreVerifiedHubCommitsInStore } = require('../lib/recruiting-verified-commits');

async function upsertPlayerPostgres(player) {
  const url = process.env.DATABASE_URL && String(process.env.DATABASE_URL).trim();
  if (!url || (process.env.SUPABASE_URL && String(process.env.SUPABASE_URL).trim())) return null;

  const { Client } = require('pg');
  const normalized = store.normalizePlayer
    ? store.normalizePlayer(player)
    : player;
  const row = {
    slug: normalized.slug,
    name: normalized.name,
    pos: normalized.pos,
    class_year: normalized.classYear,
    school: normalized.school,
    ht_wt: normalized.htWt,
    stars: normalized.stars,
    rating: normalized.rating,
    natl_rank: normalized.natlRank,
    pos_rank: normalized.posRank,
    state_rank: normalized.stateRank,
    in_state: normalized.inState,
    category: normalized.category,
    status: normalized.status,
    committed_to: normalized.committedTo,
    from_school: normalized.fromSchool,
    commit_date: normalized.commitDate,
    skinny: normalized.skinny,
    profile_note: normalized.profileNote,
    on3_id: normalized.on3Id,
    stars_display: normalized.starsDisplay,
    updated_at: normalized.updatedAt || new Date().toISOString(),
  };

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const cols = Object.keys(row);
    const vals = cols.map((_, i) => `$${i + 1}`);
    const updates = cols.filter((c) => c !== 'slug').map((c) => `${c} = EXCLUDED.${c}`);
    await client.query(
      `INSERT INTO players (${cols.join(', ')})
       VALUES (${vals.join(', ')})
       ON CONFLICT (slug) DO UPDATE SET ${updates.join(', ')}`,
      cols.map((c) => row[c])
    );
  } finally {
    await client.end().catch(() => {});
  }
  return row;
}

async function main() {
  const mcwilliams = {
    id: 'aaron-mcwilliams',
    slug: 'aaron-mcwilliams',
    name: 'Aaron McWilliams',
    pos: 'K',
    classYear: 2027,
    school: 'East Coweta, Sharpsburg GA',
    htWt: '5-11 / 185',
    stars: 0,
    rating: null,
    natlRank: null,
    posRank: null,
    stateRank: null,
    inState: false,
    category: 'recruit',
    status: 'committed',
    committedTo: 'Florida',
    commitDate: '2026-06-22',
    skinny: 'K · East Coweta · Sharpsburg, GA · UF Commit No. 24',
    profileNote: 'Combo kicker/punter; Kohl\'s No. 9 kicker nationally. Offered after Friday Night Lights camp.',
    on3Id: '280848',
    on3Slug: 'aaron-mcwilliams',
    on3ProfileUrl: 'https://www.on3.com/rivals/aaron-mcwilliams-280848/',
    ufProbability: 100,
    futurecastProbability: 100,
    pipelineState: 'committed',
    protected: true,
    updatedAt: new Date().toISOString(),
  };

  const easton = {
    id: 'easton-royal',
    slug: 'easton-royal',
    name: 'Easton Royal',
    pos: 'WR',
    classYear: 2027,
    school: 'Brother Martin HS, New Orleans LA',
    htWt: '6-0 / 175',
    stars: 4,
    rating: 90,
    natlRank: 120,
    posRank: 18,
    stateRank: 8,
    inState: false,
    category: 'target',
    status: 'uncommitted',
    committedTo: 'Texas',
    commitDate: null,
    skinny: 'Official visit to UF June 11–13; Texas commit but Florida pushing hard.',
    ufProbability: 48,
    futurecastProbability: 48,
    pipelineState: 'uncommitted',
    protected: true,
    updatedAt: new Date().toISOString(),
  };

  await store.upsertPlayer(mcwilliams);
  await store.upsertPlayer(easton);
  await upsertPlayerPostgres(mcwilliams);
  await upsertPlayerPostgres(easton);

  const restored = await restoreVerifiedHubCommitsInStore();
  const commits = await store.getHubCommits(2027);
  const board = await store.getBoard(2027);
  const eastonOnCommits = commits.some((p) => p.slug === 'easton-royal');
  const mcwilliamsOnCommits = commits.some((p) => p.slug === 'aaron-mcwilliams');
  const eastonOnTargets = (board.targets || []).some((p) => p.slug === 'easton-royal');

  console.log(
    JSON.stringify(
      {
        ok: !eastonOnCommits && mcwilliamsOnCommits,
        restoredVerified: restored,
        commitSlugs: commits.map((p) => p.slug),
        eastonOnCommits,
        mcwilliamsOnCommits,
        eastonOnTargets,
        note: 'eastonOnTargets may be false when committedTo is Texas (excluded from active UF target filter)',
      },
      null,
      2
    )
  );

  if (eastonOnCommits || !mcwilliamsOnCommits) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
