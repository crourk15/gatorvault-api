/**
 * Clear Supabase Advisor criticals:
 *   - rls_disabled_in_public
 *   - sensitive_columns_exposed
 *
 * App traffic uses SUPABASE_SERVICE_KEY / DATABASE_URL (bypasses RLS).
 * Anon/authenticated must not read or write any table via PostgREST.
 */
'use strict';

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

function databaseUrl() {
  const url = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
  return url && String(url).trim() ? String(url).trim() : '';
}

async function normalizeUrl(raw) {
  const { normalizePostgresUrl } = await import('../models/db.ts');
  return normalizePostgresUrl(raw);
}

async function withClient(fn) {
  const raw = databaseUrl();
  if (!raw) {
    const err = new Error('Missing DATABASE_URL or SUPABASE_DATABASE_URL');
    err.code = 'NO_DATABASE_URL';
    throw err;
  }
  const client = new Client({
    connectionString: await normalizeUrl(raw),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end().catch(() => {});
  }
}

async function listTablesMissingRls(client) {
  const check = await client.query(`
    SELECT n.nspname AS schema, c.relname AS table_name, c.relrowsecurity AS rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('public', 'futurecast')
      AND c.relkind = 'r'
    ORDER BY 1, 2
  `);
  const missing = check.rows.filter((r) => !r.rls_enabled).map((r) => `${r.schema}.${r.table_name}`);
  return {
    tables: check.rows,
    missing,
    rlsEnabledCount: check.rows.filter((r) => r.rls_enabled).length,
  };
}

/**
 * Read-only status for Admin Hub / Advisors follow-up.
 */
async function getSupabaseRlsStatus() {
  return withClient(async (client) => {
    const { tables, missing, rlsEnabledCount } = await listTablesMissingRls(client);
    const sensitiveMissing = tables
      .filter(
        (r) =>
          r.schema === 'public' &&
          SENSITIVE_PUBLIC_TABLES.includes(r.table_name) &&
          !r.rls_enabled
      )
      .map((r) => r.table_name);
    return {
      ok: missing.length === 0,
      configured: true,
      rlsEnabledCount,
      tableCount: tables.length,
      missingRls: missing,
      sensitiveMissing,
      advisorsLikelyClear: missing.length === 0 && sensitiveMissing.length === 0,
    };
  });
}

/**
 * Enable RLS, drop open policies, revoke anon/authenticated grants.
 * Idempotent — safe to re-run.
 *
 * @param {{ source?: string, force?: boolean }} [opts]
 */
async function applySupabaseRlsLockdown(opts = {}) {
  const source = opts.source || 'manual';
  const force = opts.force === true;

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

  return withClient(async (client) => {
    const before = await listTablesMissingRls(client);
    const alreadyLocked = before.missing.length === 0;
    const enabled = [];
    const droppedPolicies = [];

    // Always re-assert sensitive tables + catch-all missing RLS (IF EXISTS / IF NOT).
    if (force || !alreadyLocked) {
      for (const table of SENSITIVE_PUBLIC_TABLES) {
        try {
          await client.query(`ALTER TABLE IF EXISTS public."${table}" ENABLE ROW LEVEL SECURITY`);
          enabled.push(`public.${table}`);
        } catch (err) {
          // Table may not exist yet — ignore.
          if (!/does not exist/i.test(String(err.message || err))) {
            throw err;
          }
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
        enabled.push(`${row.schema}.${row.table_name}`);
      }

      const policies = await client.query(`
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname IN ('public', 'futurecast')
      `);
      for (const row of policies.rows) {
        await client.query(
          `DROP POLICY IF EXISTS "${String(row.policyname).replace(/"/g, '""')}" ON ${qIdent(row.schemaname, row.tablename)}`
        );
        droppedPolicies.push(`${row.schemaname}.${row.tablename}.${row.policyname}`);
      }
    }

    // Always re-revoke anon/authenticated — clears sensitive_columns_exposed even when RLS was already on.
    for (const sql of grants) {
      await client.query(sql);
    }

    const after = await listTablesMissingRls(client);
    const sensitiveMissing = after.tables
      .filter(
        (r) =>
          r.schema === 'public' &&
          SENSITIVE_PUBLIC_TABLES.includes(r.table_name) &&
          !r.rls_enabled
      )
      .map((r) => r.table_name);

    return {
      ok: after.missing.length === 0 && sensitiveMissing.length === 0,
      skipped: alreadyLocked && !force && enabled.length === 0,
      reason: alreadyLocked && !force ? 'rls_already_on_grants_reasserted' : undefined,
      source,
      enabled: [...new Set(enabled)],
      droppedPolicies,
      rlsEnabledCount: after.rlsEnabledCount,
      missingRls: after.missing,
      sensitiveMissing,
      advisorsLikelyClear: after.missing.length === 0 && sensitiveMissing.length === 0,
    };
  });
}

/**
 * Deferred boot heal for Render — never throws to caller.
 * Set SUPABASE_RLS_LOCKDOWN_ON_BOOT=0 to disable.
 */
function scheduleSupabaseRlsLockdownOnBoot() {
  const flag = String(process.env.SUPABASE_RLS_LOCKDOWN_ON_BOOT || '').toLowerCase();
  if (flag === '0' || flag === 'false' || flag === 'off') {
    console.log('[rls-lockdown] boot apply disabled (SUPABASE_RLS_LOCKDOWN_ON_BOOT)');
    return { scheduled: false, reason: 'disabled' };
  }
  if (!databaseUrl()) {
    console.log('[rls-lockdown] boot apply skipped (no DATABASE_URL)');
    return { scheduled: false, reason: 'no_database_url' };
  }
  // Only auto-heal on Render/production — local/dev stays manual.
  const onRender = !!(process.env.RENDER || process.env.RENDER_SERVICE_ID);
  const forceBoot = flag === '1' || flag === 'true' || flag === 'on';
  if (!onRender && !forceBoot) {
    console.log('[rls-lockdown] boot apply skipped (not on Render; set SUPABASE_RLS_LOCKDOWN_ON_BOOT=1 to force)');
    return { scheduled: false, reason: 'not_render' };
  }

  const delayMs = Math.max(5000, parseInt(process.env.SUPABASE_RLS_LOCKDOWN_BOOT_DELAY_MS || '45000', 10) || 45000);
  setTimeout(() => {
    applySupabaseRlsLockdown({ source: 'boot' })
      .then((result) => {
        if (result.skipped) {
          console.log(
            '[rls-lockdown] boot ok — RLS already on (%s tables); anon grants re-asserted',
            result.rlsEnabledCount
          );
          return;
        }
        if (result.ok) {
          console.log(
            '[rls-lockdown] boot applied — enabled=%s droppedPolicies=%s',
            result.enabled.length,
            result.droppedPolicies.length
          );
          return;
        }
        console.warn(
          '[rls-lockdown] boot incomplete — still missing:',
          (result.missingRls || []).join(', ') || '(none)',
          'sensitive:',
          (result.sensitiveMissing || []).join(', ') || '(none)'
        );
      })
      .catch((err) => {
        console.warn('[rls-lockdown] boot apply failed:', err.message || err);
      });
  }, delayMs);

  console.log('[rls-lockdown] boot apply scheduled in', Math.round(delayMs / 1000), 's');
  return { scheduled: true, delayMs };
}

module.exports = {
  SENSITIVE_PUBLIC_TABLES,
  databaseUrl,
  getSupabaseRlsStatus,
  applySupabaseRlsLockdown,
  scheduleSupabaseRlsLockdownOnBoot,
};
