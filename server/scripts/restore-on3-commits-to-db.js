#!/usr/bin/env node
/**
 * Restore UF commit rows in Postgres from the local On3 snapshot.
 * Use after disabling verified-commit demotion when historical rows were demoted to targets.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

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
  for (const year of years) {
    const commits = Object.values(snapshot.years?.[year]?.commits || {});
    for (const raw of commits) {
      const slug = String(raw.slug || '').toLowerCase();
      if (!slug) continue;
      const result = await client.query(
        `UPDATE players
         SET status = 'committed',
             committed_to = 'Florida',
             category = 'recruit',
             updated_at = NOW()
         WHERE slug = $1
           AND class_year = $2
         RETURNING slug`,
        [slug, year]
      );
      if (result.rowCount) restored += 1;
    }
    console.log(`Year ${year}: processed ${commits.length} On3 commits, restored ${restored}`);
  }

  await client.end();
  console.log('Restored rows total:', restored);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
