# FutureCast API (v1)

REST handlers for FutureCast Big Board and related endpoints.

**Spec:** `server/docs/futurecast-platform-spec.md` §3.2–§3.4

Mount under `/api/futurecast/*` when wired into Express.

| File | Route |
|------|-------|
| `big-board.ts` | `GET /api/futurecast/big-board` |
| `early-discovery.ts` | `GET /api/futurecast/early-discovery` |
| `portal-watchlist.ts` | Re-export or alias for portal tab |
| `predictions.ts` | Predictions tab data |
| `movement-tracker.ts` | Movement Tracker tab data |
