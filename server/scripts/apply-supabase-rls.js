#!/usr/bin/env node
/**
 * Apply RLS hardening to Supabase (fixes Advisor: rls_disabled_in_public).
 *
 * Usage:
 *   cd server && node scripts/apply-supabase-rls.js
 *
 * Or paste server/migrations/022_enable_rls_public_tables.sql into Supabase SQL Editor.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const SQL_PATH = path.join(__dirname, '..', 'migrations', '022_enable_rls_public_tables.sql');

async function main() {
  const { normalizePostgresUrl } = await import('../models/db.ts');
  const url = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
  if (!url || !String(url).trim()) {
    console.error('Missing DATABASE_URL or SUPABASE_DATABASE_URL in server/.env');
    process.exit(1);
  }

  const client = new Client({
    connectionString: normalizePostgresUrl(String(url).trim()),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const sql = fs.readFileSync(SQL_PATH, 'utf8');
    console.log('[rls] Applying 022_enable_rls_public_tables.sql...');
    await client.query(sql);

    const check = await client.query(`
      SELECT n.nspname AS schema, c.relname AS table_name, c.relrowsecurity AS rls_enabled
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname IN ('public', 'futurecast')
        AND c.relkind = 'r'
      ORDER BY 1, 2
    `);
    const missing = check.rows.filter((r) => !r.rls_enabled);
    console.log('[rls] Tables with RLS:', check.rows.filter((r) => r.rls_enabled).length);
    if (missing.length) {
      console.warn('[rls] Still without RLS:', missing.map((r) => `${r.schema}.${r.table_name}`).join(', '));
      process.exit(1);
    }
    console.log('[rls] Done - re-run Supabase Advisors to confirm rls_disabled_in_public is cleared.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[rls] Failed:', err.message);
  process.exit(1);
});