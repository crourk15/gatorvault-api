# FutureCast Postgres migrations

Apply in order via **Supabase SQL Editor** or `psql`:

```bash
psql "$DATABASE_URL" -f server/migrations/001_create_player_table.sql
psql "$DATABASE_URL" -f server/migrations/002_create_high_school_profiles_table.sql
psql "$DATABASE_URL" -f server/migrations/003_create_college_profiles_table.sql
psql "$DATABASE_URL" -f server/migrations/004_create_portal_profiles_table.sql
psql "$DATABASE_URL" -f server/migrations/005_create_uf_specific_profiles_table.sql
psql "$DATABASE_URL" -f server/migrations/006_create_discovery_signals_table.sql
psql "$DATABASE_URL" -f server/migrations/007_hs_profiles_unique_player_id.sql
psql "$DATABASE_URL" -f server/migrations/008_college_profiles_unique_player_id.sql
psql "$DATABASE_URL" -f server/migrations/009_portal_profiles_unique_player_id.sql
psql "$DATABASE_URL" -f server/migrations/010_uf_specific_profiles_unique_player_id.sql
psql "$DATABASE_URL" -f server/migrations/011_create_predictions_table.sql
```

| File | Issue | Description |
|------|-------|-------------|
| `001_create_player_table.sql` | #12 | `futurecast.players` — canonical Player entity |
| `002_create_high_school_profiles_table.sql` | #13 | `futurecast.high_school_profiles` — HS offers, stats, discovery_score |
| `007_hs_profiles_unique_player_id.sql` | — | Unique `player_id` on HS profiles (upsert); skip if 002 applied fresh |
| `003_create_college_profiles_table.sql` | #14 | `futurecast.college_profiles` — college snaps, stats, depth history |
| `008_college_profiles_unique_player_id.sql` | — | Unique `player_id` on college profiles (upsert); skip if 003 applied fresh |
| `009_portal_profiles_unique_player_id.sql` | — | Unique `player_id` on portal profiles (upsert); skip if 004 applied fresh |
| `010_uf_specific_profiles_unique_player_id.sql` | — | Unique `player_id` on UF profiles (upsert); skip if 005 applied fresh |
| `004_create_portal_profiles_table.sql` | #15 | `futurecast.portal_profiles` — portal status, likelihood, reason tags |
| `005_create_uf_specific_profiles_table.sql` | #16 | `futurecast.uf_specific_profiles` — UF Fit sub-scores, status, metadata |
| `006_create_discovery_signals_table.sql` | #17 | `futurecast.discovery_signals` — immutable Early Discovery event log |
| `020_create_push_subscriptions.sql` | — | `push_subscriptions`, `push_dispatch_fingerprints` |
| `022_enable_rls_public_tables.sql` | Security | Enable RLS on `public` + `futurecast`; revoke anon/authenticated table grants |
| `024_lockdown_supabase_api.sql` | **CRITICAL** | Paste into Supabase SQL Editor — clears `rls_disabled_in_public` + `sensitive_columns_exposed` |

**Note:** FutureCast tables live in the `futurecast` schema to avoid conflicting with legacy `public.players` (GatorVault recruiting store). The TypeScript model uses `FUTURECAST_PLAYERS_TABLE = 'futurecast.players'`.


## Supabase Advisor lockdown (do this when email warns)

**Automatic (preferred):** After this lands on `main`, Render `gatorvault-api` auto-applies RLS ~45s after boot (`scheduleSupabaseRlsLockdownOnBoot`). Disable with `SUPABASE_RLS_LOCKDOWN_ON_BOOT=0`.

**Admin Hub (manual):**
```bash
curl -X POST https://gatorvault-api.onrender.com/api/admin/hub/security/lockdown-rls \
  -H "Content-Type: application/json" \
  -H "X-Ops-Pin: $OPS_ADMIN_PIN"
```
Status: `GET /api/admin/hub/security/rls-status` (same pin header).

**SQL Editor fallback:**
1. Open [Supabase](https://supabase.com/dashboard) → project **GatorVault** (`ualpmnglskpqmkpnckid`)
2. **SQL Editor** → New query
3. Paste entire contents of `024_lockdown_supabase_api.sql`
4. Run → verify the final SELECT returns **0 rows**
5. **Advisors** → refresh — Critical issues should clear

Or with `DATABASE_URL` locally:

```bash
cd server && node scripts/apply-supabase-rls.js
```

App traffic is unaffected: Render uses `SUPABASE_SERVICE_KEY` / `DATABASE_URL`, which bypass RLS.
