#!/usr/bin/env node
/**
 * Apply RLS lockdown to Supabase (clears Advisors):
 *   - rls_disabled_in_public
 *   - sensitive_columns_exposed
 *
 * Usage:
 *   cd server && node scripts/apply-supabase-rls.js
 *
 * Uses simple ALTER/REVOKE statements — Supabase transaction pooler rejects DO $$ blocks.
 * Prefer SQL Editor paste of migrations/024_lockdown_supabase_api.sql when available.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Client } = require('pg');

/** Tables known to hold emails / tokens / prefs — must never be anon-readable. */
const SENSITIVE_PUBLIC_TABLES = [
  'push_subscriptions',
  'push_device_tokens',
  'alert_email_preferences',
  'players',
  'recruiting_events',
  'recruiting_intel',
  'recruiting_identity_patterns',
  'autoposter_detectives_doc',
  'autoposter_queue_doc',
  'autoposter_sent_ledger',
  'autoposter_player_resolution',
  'push_dispatch_fingerprints',
  'class_rankings',
];

function qIdent(schema, table) {
  return `${schema}."${String(table).replace(/"/g, '""')}"`;
}

async function main() {
  const { normalizePostgresUrl } = await import('../models/db.ts');
  const url = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
  if (!url || !String(url).trim()) {
    console.error('Missing DATABASE_URL or SUPABASE_DATABASE_URL in server/.env');
    console.error('Fast path: paste server/migrations/024_lockdown_supabase_api.sql into Supabase SQL Editor.');
    process.exit(1);
  }

  const client = new Client({
    connectionString: normalizePostgresUrl(String(url).trim()),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    // Explicit sensitive tables first (even if already present) — clear Advisor naming.
    for (const table of SENSITIVE_PUBLIC_TABLES) {
      try {
        await client.query(`ALTER TABLE IF EXISTS public."${table}" ENABLE ROW LEVEL SECURITY`);
        console.log('[rls] ensured public.' + table);
      } catch (err) {
        console.warn('[rls] skip public.' + table + ':', err.message);
      }
    }

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

    // Drop open policies that would keep tables publicly readable under RLS.
    const policies = await client.query(`
      SELECT schemaname, tablename, policyname
      FROM pg_policies
      WHERE schemaname IN ('public', 'futurecast')
    `);
    for (const row of policies.rows) {
      await client.query(
        `DROP POLICY IF EXISTS "${String(row.policyname).replace(/"/g, '""')}" ON ${qIdent(row.schemaname, row.tablename)}`
      );
      console.log('[rls] dropped policy', `${row.schemaname}.${row.tablename}.${row.policyname}`);
    }

    const grants = [
      'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated',
      'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated',
      'REVOKE ALL ON ALL TABLES IN SCHEMA futurecast FROM anon, authenticated',
      'REVOKE ALL ON ALL SEQUENCES IN SCHEMA futurecast FROM anon, authenticated',
      'GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role',
      'GRANT USAGE ON SCHEMA futurecast TO anon, authenticated, service_role',
      'GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role',
      'GRANT ALL ON ALL TABLES IN SCHEMA futurecast TO service_role',
      'GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role',
      'GRANT ALL ON ALL SEQUENCES IN SCHEMA futurecast TO service_role',
      'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated',
      'ALTER DEFAULT PRIVILEGES IN SCHEMA futurecast REVOKE ALL ON TABLES FROM anon, authenticated',
      'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role',
      'ALTER DEFAULT PRIVILEGES IN SCHEMA futurecast GRANT ALL ON TABLES TO service_role',
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

    const sensitiveMissing = check.rows.filter(
      (r) =>
        r.schema === 'public' &&
        SENSITIVE_PUBLIC_TABLES.includes(r.table_name) &&
        !r.rls_enabled
    );
    if (sensitiveMissing.length) {
      console.error(
        '[rls] Sensitive tables still without RLS:',
        sensitiveMissing.map((r) => r.table_name).join(', ')
      );
      process.exit(1);
    }

    if (still.length) {
      console.warn(
        '[rls] Still without RLS:',
        still.map((r) => `${r.schema}.${r.table_name}`).join(', ')
      );
      process.exit(1);
    }

    console.log('[rls] Done.');
    console.log('[rls] Next: Supabase → Advisors → re-run / refresh.');
    console.log('[rls] Expect rls_disabled_in_public + sensitive_columns_exposed cleared.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[rls] Failed:', err.message);
  console.error('[rls] Fast path: paste server/migrations/024_lockdown_supabase_api.sql into Supabase SQL Editor.');
  process.exit(1);
});
