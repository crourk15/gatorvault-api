# FutureCast Players API (Phase 3)

Base path: `/api/players`

| Method | Path | Handler |
|--------|------|---------|
| GET | `/api/players` | List with filters + summary |
| GET | `/api/players/slug/:slug` | Full player by slug |
| GET | `/api/players/:id` | Full player by UUID |
| GET | `/api/players/:id/profiles` | All profiles |
| GET | `/api/players/:id/signals` | Discovery signals |
| GET | `/api/players/:id/related` | Same position + class, Big Board rank |

Requires `DATABASE_URL`. Responses use **camelCase** JSON.

Mounted from `server.js` via `lib/futurecast-players-routes.js` (tsx runtime).
