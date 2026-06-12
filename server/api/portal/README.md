# FutureCast Portal Intelligence API (Phase 6)

Base path: `/api/portal`

| Method | Path | Handler |
|--------|------|---------|
| GET | `/api/portal/watchlist` | Elevated portal likelihood candidates |
| GET | `/api/portal/predictions/:id` | Transfer destination predictions + intel scores |

Engine: `server/api/portal/engine.ts`  
Repository: `server/models/portal-intel.ts`

Mounted via `lib/futurecast-players-routes.js`.
