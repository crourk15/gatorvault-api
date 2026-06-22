#!/usr/bin/env node
/**
 * Restore UF commit rows in Postgres from the local On3 snapshot.
 * Use after disabling verified-commit demotion when historical rows were demoted to targets.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');
const { slugify } = require('../lib/slug');

function snapshotCommitToRow(raw, year) {
  const slug = String(raw.slug || slugify(raw.name)).toLowerCase();
  if (!slug || !raw.name) return null;
  return {
    slug,
    name: raw.name,
    pos: raw.pos || null,
    class_year: year,
    school: raw.school || null,
    ht_wt: raw.htWt || null,
    stars: raw.stars ?? null,
    rating: raw.rating ?? null,
    natl_rank: raw.natlRank ?? null,
    pos_rank: raw.posRank ?? null,
    state_rank: raw.stateRank ?? null,
    in_state: raw.inState ?? null,
    category: 'recruit',
    status: 'committed',
    committed_to: 'Florida',
    commit_date: raw.commitDate || null,
    on3_id: raw.on3Id ? String(raw.on3Id) : null,
    skinny: raw.skinny || null,
  };
}

async function main() {
  const url = process.env.DATABASE_URL && String(process.env.DATABASE_URL).trim();
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const snapshot = require('../data/recruiting/on3-snapshot.json');
  const years = (process.argv[2] || '2027')
    .split(',')
    .map((y) => parseInt(y.trim(), 10))
    .filter((y) => Number.isFinite(y));

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  let restored = 0;
  let inserted = 0;
  for (const year of years) {
    const commits = Object.values(snapshot.years?.[year]?.commits || {});
    let yearRestored = 0;
    let yearInserted = 0;

    for (const raw of commits) {
      const row = snapshotCommitToRow(raw, year);
      if (!row) continue;

      const updateResult = await client.query(
        `UPDATE players
         SET status = 'committed',
             committed_to = 'Florida',
             category = 'recruit',
             name = COALESCE($3, name),
             pos = COALESCE($4, pos),
             school = COALESCE($5, school),
             ht_wt = COALESCE($6, ht_wt),
             stars = COALESCE($7, stars),
             rating = COALESCE($8, rating),
             natl_rank = COALESCE($9, natl_rank),
             pos_rank = COALESCE($10, pos_rank),
             state_rank = COALESCE($11, state_rank),
             in_state = COALESCE($12, in_state),
             commit_date = COALESCE($13, commit_date),
             on3_id = COALESCE($14, on3_id),
             skinny = COALESCE($15, skinny),
             updated_at = NOW()
         WHERE slug = $1
           AND class_year = $2
         RETURNING slug`,
        [
          row.slug,
          row.class_year,
          row.name,
          row.pos,
          row.school,
          row.ht_wt,
          row.stars,
          row.rating,
          row.natl_rank,
          row.pos_rank,
          row.state_rank,
          row.in_state,
          row.commit_date,
          row.on3_id,
          row.skinny,
        ]
      );

      if (updateResult.rowCount) {
        yearRestored += 1;
        continue;
      }

      await client.query(
        `INSERT INTO players (
           slug, name, pos, class_year, school, ht_wt, stars, rating,
           natl_rank, pos_rank, state_rank, in_state, category, status,
           committed_to, commit_date, on3_id, skinny, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8,
           $9, $10, $11, $12, $13, $14,
           $15, $16, $17, $18, NOW()
         )`,
        [
          row.slug,
          row.name,
          row.pos,
          row.class_year,
          row.school,
          row.ht_wt,
          row.stars,
          row.rating,
          row.natl_rank,
          row.pos_rank,
          row.state_rank,
          row.in_state,
          row.category,
          row.status,
          row.committed_to,
          row.commit_date,
          row.on3_id,
          row.skinny,
        ]
      );
      yearInserted += 1;
    }

    restored += yearRestored;
    inserted += yearInserted;
    console.log(
      `Year ${year}: processed ${commits.length} On3 commits, restored ${yearRestored}, inserted ${yearInserted}`
    );
  }

  await client.end();
  console.log('Restored rows total:', restored);
  console.log('Inserted rows total:', inserted);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
