# FutureCast data models

TypeScript model layer for the unified player graph.

**Spec:** `server/docs/futurecast-platform-spec.md` §1 Core data model

| File | Entity |
|------|--------|
| `player.ts` | Player |
| `highschool-profile.ts` | HighSchoolProfile |
| `college-profile.ts` | CollegeProfile |
| `portal-profile.ts` | PortalProfile |
| `uf-specific-profile.ts` | UFSpecificProfile |
| `discovery-signal.ts` | DiscoverySignal |

Implement DB accessors (Postgres/Supabase) in Phase 1. Until then, export types + stub CRUD signatures.
