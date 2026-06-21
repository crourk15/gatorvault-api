#!/usr/bin/env node
/**
 * Apply recruiting + FutureCast Postgres schema to Supabase.
 *
 * Requires DATABASE_URL (or SUPABASE_DATABASE_URL) in server/.env — direct Postgres URI.
 *
 * Usage:
 *   cd server && node scripts/apply-supabase-schema.js
 *   cd server && node scripts/apply-supabase-schema.js --seed
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const ROOT = path.join(__dirname, '..');
const RECRUITING_SCHEMA = path.join(ROOT, 'supabase', 'schema.sql');
const MIGRATIONS_DIR = path.join(ROOT, 'migrations');

async function getDatabaseUrl() {
  const { normalizePostgresUrl } = await import('../models/db.ts');
  const url = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
  if (!url || !String(url).trim()) {
    console.error('Missing DATABASE_URL or SUPABASE_DATABASE_URL in server/.env');
    process.exit(1);
  }
  return normalizePostgresUrl(String(url).trim());
}

function migrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{3}_.*\.sql$/.test(f))
    .sort();
}

async function runSqlFile(client, filePath, label) {
  const sql = fs.readFileSync(filePath, 'utf8');
  console.log(`[schema] Applying ${label}…`);
  await client.query(sql);
  console.log(`[schema] OK ${label}`);
}

async function seedPlayersFromJson(client) {
  const playersPath = path.join(ROOT, 'data', 'recruiting', 'players.json');
  if (!fs.existsSync(playersPath)) {
    console.warn('[schema] Skip seed — players.json not found');
    return;
  }
  const store = require('../lib/recruiting-store');
  const players = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
  if (!Array.isArray(players) || !players.length) return;

  const sql = `
    insert into players (
      slug, name, pos, class_year, school, ht_wt, stars, rating,
      natl_rank, pos_rank, state_rank, in_state, category, status,
      committed_to, from_school, commit_date, skinny, profile_note, on3_id, stars_display, updated_at
    ) values (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,now()
    )
    on conflict (slug) do update set
      name = excluded.name,
      pos = excluded.pos,
      class_year = excluded.class_year,
      school = excluded.school,
      ht_wt = excluded.ht_wt,
      stars = excluded.stars,
      rating = excluded.rating,
      natl_rank = excluded.natl_rank,
      pos_rank = excluded.pos_rank,
      state_rank = excluded.state_rank,
      in_state = excluded.in_state,
      category = excluded.category,
      status = excluded.status,
      committed_to = excluded.committed_to,
      from_school = excluded.from_school,
      commit_date = excluded.commit_date,
      skinny = excluded.skinny,
      profile_note = excluded.profile_note,
      on3_id = excluded.on3_id,
      stars_display = excluded.stars_display,
      updated_at = now()
  `;

  let upserted = 0;
  for (const raw of players) {
    if (!raw?.slug || String(raw.slug).toLowerCase() === 'test-recruit') continue;
    const p = store.normalizePlayer(raw);
    const row = {
      slug: p.slug,
      name: p.name,
      pos: p.pos || 'ATH',
      classYear: p.classYear,
      school: p.school,
      htWt: p.htWt,
      stars: p.stars,
      rating: p.rating,
      natlRank: p.natlRank,
      posRank: p.posRank,
      stateRank: p.stateRank,
      inState: p.inState,
      category: p.category || 'target',
      status: p.status || 'target',
      committedTo: p.committedTo,
      fromSchool: p.fromSchool,
      commitDate: p.commitDate,
      skinny: p.skinny,
      profileNote: p.profileNote,
      on3Id: p.on3Id,
      starsDisplay: p.starsDisplay,
    };
    await client.query(sql, [
      row.slug,
      row.name,
      row.pos,
      row.classYear,
      row.school,
      row.htWt,
      row.stars,
      row.rating,
      row.natlRank,
      row.posRank,
      row.stateRank,
      row.inState,
      row.category,
      row.status,
      row.committedTo,
      row.fromSchool,
      row.commitDate,
      row.skinny,
      row.profileNote,
      row.on3Id,
      row.starsDisplay,
    ]);
    upserted += 1;
  }
  console.log(`[schema] Seeded ${upserted} rows into public.players`);
}

async function main() {
  const seed = process.argv.includes('--seed');
  const connectionString = await getDatabaseUrl();
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await runSqlFile(client, RECRUITING_SCHEMA, 'supabase/schema.sql (public recruiting)');
    const statusPatch = path.join(ROOT, 'supabase', 'patch-players-status.sql');
    if (fs.existsSync(statusPatch)) {
      await runSqlFile(client, statusPatch, 'supabase/patch-players-status.sql');
    }
    for (const file of migrationFiles()) {
      await runSqlFile(client, path.join(MIGRATIONS_DIR, file), `migrations/${file}`);
    }
    const tables = await client.query(`
      select table_schema, table_name
      from information_schema.tables
      where table_schema in ('public', 'futurecast')
        and table_type = 'BASE TABLE'
      order by 1, 2
    `);
    console.log(
      '[schema] Tables:',
      tables.rows.map((r) => `${r.table_schema}.${r.table_name}`).join(', ')
    );
    if (seed) await seedPlayersFromJson(client);
  } finally {
    await client.end();
  }
  console.log('[schema] Done — run: node scripts/sync-render-env.js --deploy');
}

main().catch((err) => {
  console.error('[schema] Failed:', err.message);
  process.exit(1);
});
