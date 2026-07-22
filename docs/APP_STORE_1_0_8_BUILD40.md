# Submit 1.0.8 (Build 40) — elite platform harden

Build **40** closes the deep-audit gaps that blocked overall elite status.

## Critical

- Block reserved operator email self-register; force register tier `locker`
- Paid API gates use live user entitlement (not stale JWT tier)
- Apple IAP JWT signed with IEEE P1363
- IAP bind: reject tx already linked to another account; validate appAccountToken
- Production rejects published default admin PIN (`GV2026admin`)
- Community atomic writes + refuse founding reseed on corrupt store
- Recruiting + FutureCast durable `/var/data` paths
- UTF-16 push/email preference migrations fixed to UTF-8

## High / runtime

- Push registration no longer wipe-all listeners (tap race fixed)
- IAP double-ack tolerated; Membership delete UI available if status fails
- Hub auto-retry bounded; `/vault/film` redirect; Community thread URL sync
- Honest Community seed pulse (trending = threads with replies only)

## iOS

- `MARKETING_VERSION = 1.0.8`
- `CURRENT_PROJECT_VERSION = 40`

## Ops after merge

1. Confirm Render has a real operator pin (`OPS_ADMIN_PIN` / `EMAIL_TEST_PIN`) — default PIN is dead in prod
2. Confirm `GV_RECRUITING_DATA_DIR` + `GV_COMMUNITY_DATA_DIR` on disk
3. Codemagic → TestFlight **40**
4. Post real staff Community replies via admin
