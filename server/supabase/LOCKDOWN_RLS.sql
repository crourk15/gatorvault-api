-- =============================================================================
-- CRITICAL: Clear Supabase Advisors
--   - rls_disabled_in_public
--   - sensitive_columns_exposed  (push emails/tokens, alert prefs, etc.)
--
-- GatorVault app access path:
--   Render API → SUPABASE_SERVICE_KEY / DATABASE_URL (bypasses RLS)
-- Browser anon/authenticated must NOT read or write any table.
--
-- APPLY NOW (fastest):
--   Supabase Dashboard → project GatorVault (ualpmnglskpqmkpnckid)
--   → SQL Editor → New query → paste this whole file → Run
--
-- Or from a machine with DATABASE_URL:
--   cd server && node scripts/apply-supabase-rls.js
-- =============================================================================

-- 1) Enable RLS on known public tables (IF EXISTS — safe to re-run)
ALTER TABLE IF EXISTS public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.class_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.recruiting_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.recruiting_identity_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.recruiting_intel ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.push_dispatch_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.push_device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.alert_email_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.autoposter_sent_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.autoposter_player_resolution ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.autoposter_detectives_doc ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.autoposter_queue_doc ENABLE ROW LEVEL SECURITY;

-- 2) Enable RLS on futurecast schema (defense in depth)
ALTER TABLE IF EXISTS futurecast.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS futurecast.high_school_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS futurecast.college_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS futurecast.portal_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS futurecast.uf_specific_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS futurecast.discovery_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS futurecast.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS futurecast.prediction_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS futurecast.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS futurecast.player_slugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS futurecast.competing_school_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS futurecast.rolling_movement ENABLE ROW LEVEL SECURITY;

-- 3) Catch-all: any other base tables in public/futurecast still missing RLS
--    (SQL Editor / session mode). Transaction pooler may reject DO $$ — use
--    scripts/apply-supabase-rls.js there instead.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('public', 'futurecast')
      AND c.relkind = 'r'
      AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', r.schema_name, r.table_name);
    RAISE NOTICE 'RLS enabled on %.%', r.schema_name, r.table_name;
  END LOOP;
END $$;

-- 4) Drop any accidental open policies that would re-expose data to anon
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname IN ('public', 'futurecast')
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname,
      r.schemaname,
      r.tablename
    );
    RAISE NOTICE 'Dropped policy %.%.%', r.schemaname, r.tablename, r.policyname;
  END LOOP;
END $$;

-- 5) Revoke PostgREST grants from browser-facing roles
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA futurecast FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA futurecast FROM anon, authenticated;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA futurecast TO anon, authenticated, service_role;

-- service_role keeps full access via Supabase client (bypasses RLS)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA futurecast TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA futurecast TO service_role;

-- 6) Future tables: do not auto-grant to anon/authenticated
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA futurecast REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA futurecast GRANT ALL ON TABLES TO service_role;

-- 7) Verify — expect zero rows
SELECT n.nspname AS schema, c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'futurecast')
  AND c.relkind = 'r'
  AND NOT c.relrowsecurity
ORDER BY 1, 2;
