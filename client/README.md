# FutureCast frontend (scaffolding)

React/TypeScript SPA skeleton for FutureCast Big Board and Player Profiles 2.0.

**Spec:** `server/docs/futurecast-platform-spec.md` §4, §5

> **Production UI today:** `server/futurecast-big-board.html` at `/futurecast/big-board` — fetches `GET /api/big-board`. This `client/` tree is the Vite/React target architecture.

## API client

`client/lib/big-board-api.ts` — `fetchBigBoard()`, types, and tab sort presets.

`client/lib/player-api.ts` — `fetchPlayerProfile()`, types, share URL builder.

`client/lib/portal-api.ts` — Portal Watchlist + transfer predictions.

`client/lib/uf-fit-api.ts` — UF Fit Watchlist + player intel.

## Routes

| Path | Component |
|------|-----------|
| `/futurecast/big-board` | Big Board hub (production HTML) |
| `/futurecast/player/:slug` | Player Profile 2.0 (production HTML) |
| `/futurecast/portal-watchlist` | Portal Watchlist (production HTML) |
| `/futurecast/uf-fit-watchlist` | UF Fit Watchlist (production HTML) |
| `/futurecast/big-board/*` | Tab views (React) |
| `/futurecast/player/:slug` | Player Profiles 2.0 (React) |

## Components

See `client/components/futurecast/README.md`.
