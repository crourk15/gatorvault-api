# FutureCast UF Fit API (Phase 7)

Base path: `/api/uf-fit`

| Method | Path | Handler |
|--------|------|---------|
| GET | `/api/uf-fit/watchlist` | UF Fit candidates (tier, score filters) |
| GET | `/api/uf-fit/:id` | Full UF Fit intel + history |

Engine: `server/api/uf-fit/engine.ts`  
Repository: `server/models/uf-fit-intel.ts`

Fit tiers: Elite ≥85, Strong 70–84, Moderate 50–69, Low <50.
