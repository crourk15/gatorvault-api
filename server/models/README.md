# FutureCast data models

TypeScript model layer for the unified player graph.

**Spec:** `server/docs/futurecast-platform-spec.md` §1 Core data model

| File | Role |
|------|------|
| `db.ts` | Postgres pool (`DATABASE_URL`) |
| `player.ts` | Player repository (CRUD) |
| `player-types.ts` | Player types + row mappers |
| `highschool-profile.ts` | HighSchoolProfile repository (CRUD) |
| `highschool-profile-types.ts` | HighSchoolProfile types + row mappers |
| `college-profile.ts` | CollegeProfile repository (CRUD) |
| `college-profile-types.ts` | CollegeProfile types + row mappers |
| `portal-profile.ts` | PortalProfile repository (CRUD) |
| `portal-profile-types.ts` | PortalProfile types + row mappers |
| `uf-specific-profile.ts` | UFSpecificProfile repository (CRUD) |
| `uf-specific-profile-types.ts` | UFSpecificProfile types + row mappers |
| `discovery-signal.ts` | DiscoverySignal repository (insert + list) |
| `discovery-signal-types.ts` | DiscoverySignal types + row mappers |
| `../shared/enums.ts` | Shared enums (Portal, UF, Signal, Position, etc.) |

| Migration | Model |
|-----------|-------|
| `server/migrations/001_create_player_table.sql` | `player.ts` → `futurecast.players` |
| `server/migrations/002_create_high_school_profiles_table.sql` | `highschool-profile.ts` → `futurecast.high_school_profiles` |
| `server/migrations/007_hs_profiles_unique_player_id.sql` | Unique `player_id` for HS upsert (if 002 applied earlier) |
| `server/migrations/003_create_college_profiles_table.sql` | `college-profile.ts` → `futurecast.college_profiles` |
| `server/migrations/008_college_profiles_unique_player_id.sql` | Unique `player_id` for college upsert (if 003 applied earlier) |
| `server/migrations/004_create_portal_profiles_table.sql` | `portal-profile.ts` → `futurecast.portal_profiles` |
| `server/migrations/009_portal_profiles_unique_player_id.sql` | Unique `player_id` for portal upsert (if 004 applied earlier) |
| `server/migrations/005_create_uf_specific_profiles_table.sql` | `uf-specific-profile.ts` → `futurecast.uf_specific_profiles` |
| `server/migrations/010_uf_specific_profiles_unique_player_id.sql` | Unique `player_id` for UF upsert (if 005 applied earlier) |
| `server/migrations/006_create_discovery_signals_table.sql` | `discovery-signal.ts` → `futurecast.discovery_signals` |

Set `DATABASE_URL` (Supabase direct Postgres connection string) before calling repositories.
