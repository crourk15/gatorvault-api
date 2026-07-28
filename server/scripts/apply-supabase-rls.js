#!/usr/bin/env node
/**
 * Apply RLS lockdown to Supabase (clears Advisors):
 *   - rls_disabled_in_public
 *   - sensitive_columns_exposed
 *
 * Usage:
 *   cd server && node scripts/apply-supabase-rls.js
 *   cd server && node scripts/apply-supabase-rls.js --force
 *
 * Uses simple ALTER/REVOKE statements — Supabase transaction pooler rejects DO $$ blocks.
 * Prefer SQL Editor paste of migrations/024_lockdown_supabase_api.sql when available.
 */
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const {
  applySupabaseRlsLockdown,
  SENSITIVE_PUBLIC_TABLES,
} = require('../lib/supabase-rls-lockdown');

async function main() {
  const force = process.argv.includes('--force');
  try {
    const result = await applySupabaseRlsLockdown({ source: 'cli', force });
    if (result.skipped) {
      console.log(
        '[rls] RLS already on (%s tables); anon/authenticated grants re-asserted. Use --force to re-enable + drop policies.',
        result.rlsEnabledCount
      );
      process.exit(0);
    }
    console.log('[rls] Enabled / ensured:', result.enabled.length ? result.enabled.join(', ') : '(none new)');
    console.log('[rls] Dropped policies:', result.droppedPolicies.length);
    console.log('[rls] Tables with RLS:', result.rlsEnabledCount);
    if (result.sensitiveMissing.length) {
      console.error('[rls] Sensitive tables still without RLS:', result.sensitiveMissing.join(', '));
      process.exit(1);
    }
    if (result.missingRls.length) {
      console.warn('[rls] Still without RLS:', result.missingRls.join(', '));
      process.exit(1);
    }
    console.log('[rls] Done. Sensitive tables covered:', SENSITIVE_PUBLIC_TABLES.length);
    console.log('[rls] Next: Supabase → Advisors → re-run / refresh.');
    console.log('[rls] Expect rls_disabled_in_public + sensitive_columns_exposed cleared.');
    console.log('[rls] Fast path reference: migrations/024_lockdown_supabase_api.sql');
  } catch (err) {
    console.error('[rls] Failed:', err.message);
    console.error('[rls] Fast path: paste server/migrations/024_lockdown_supabase_api.sql into Supabase SQL Editor.');
    process.exit(1);
  }
}

main();
