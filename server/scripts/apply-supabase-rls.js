#!/usr/bin/env node
/**
 * Apply RLS hardening to Supabase (fixes Advisor: rls_disabled_in_public).
 *
 * Usage:
 *   cd server && node scripts/apply-supabase-rls.js
 *
 * Uses simple ALTER/REVOKE statements — Supabase transaction pooler rejects DO $$ blocks.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Client } = require('pg');

function qIdent(schema, table) {
  return `${schema}."${String(table).replace(/"/g, '""')}"`;
}

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
    const missing = await client.query(`
      SELECT n.nspname AS schema, c.relname AS table_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname IN ('public', 'futurecast')
        AND c.relkind = 'r'
        AND NOT c.relrowsecurity
      ORDER BY 1, 2
    `);

    for (const row of missing.rows) {
      await client.query(`ALTER TABLE ${qIdent(row.schema, row.table_name)} ENABLE ROW LEVEL SECURITY`);
      console.log('[rls] enabled', `${row.schema}.${row.table_name}`);
    }

    const grants = [
      'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated',
      'REVOKE ALL ON ALL TABLES IN SCHEMA futurecast FROM anon, authenticated',
      'GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role',
      'GRANT USAGE ON SCHEMA futurecast TO anon, authenticated, service_role',
    ];
    for (const sql of grants) {
      await client.query(sql);
      console.log('[rls]', sql);
    }

    const check = await client.query(`
      SELECT n.nspname AS schema, c.relname AS table_name, c.relrowsecurity AS rls_enabled
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname IN ('public', 'futurecast')
        AND c.relkind = 'r'
      ORDER BY 1, 2
    `);
    const still = check.rows.filter((r) => !r.rls_enabled);
    console.log('[rls] Tables with RLS:', check.rows.filter((r) => r.rls_enabled).length);
    if (still.length) {
      console.warn(
        '[rls] Still without RLS:',
        still.map((r) => `${r.schema}.${r.table_name}`).join(', ')
      );
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
