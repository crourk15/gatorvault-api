# FutureCast frontend (scaffolding)

React/TypeScript SPA skeleton for FutureCast Big Board and Player Profiles 2.0.

**Spec:** `server/docs/futurecast-platform-spec.md` §4, §5

> Today production UI lives in `server/index.html`. This `client/` tree is the target architecture for a Vite/React split.

## Routes

| Path | Component |
|------|-----------|
| `/futurecast` | Big Board hub |
| `/futurecast/big-board/*` | Tab views |
| `/players/:playerId` | Player Profiles 2.0 |

## Components

See `client/components/futurecast/README.md`.
