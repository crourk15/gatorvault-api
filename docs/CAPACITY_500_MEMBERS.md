# Capacity prep — ~500 members

Prep work so GatorVault does not scramble when membership grows. Target: **~500 trial + paid accounts**, steady login/session traffic, visit alerts, and email drip — on the current **single Render Pro dyno** + durable JSON auth store.

## Current baseline (Aug 2026)

| Layer | State |
|---|---|
| Auth store | `/var/data/users.json` (1 GB disk) — atomic rename writes |
| Sessions | Stateless HMAC tokens (30d) — no server session map |
| API | `gatorvault-api` Pro, single instance, cheap `/ready` |
| Stripe web | Optional; not required for Apple IAP members |
| Postgres | Recruiting / push prefs / FutureCast — **not** auth users |

File size at 500 accounts is fine. Real risks: **lost updates** across async gaps, **full-file scans** on every gated call, **auth abuse** (scrypt), and **alert/email fan-out** on the same dyno as hub warm.

## Phased prep

### Phase 1 — ship first (this change set)

1. **Serialize member mutations** — `mutateUsers` / always re-read before write after awaits; register onboarding stamps via `updateUser`.
2. **In-memory users cache** (mtime-aware) — cut repeated disk parse on login / tier gates.
3. **Auth rate limits** — login / register / forgot-password (IP + email).
4. **Durable Vault Points** — `GV_POINTS_PATH` on `/var/data` (same pattern as users).

### Phase 2 — before alert coverage ≈ membership size

5. Visit push/email: one user-map load + bounded concurrency (`push-alert-service`, `visit-intel-email-digest`).
6. `announce-ios` / drip: chunk sends; persist stamps incrementally; keep off `/ready` path.
7. Stripe webhook event-id idempotency log (when web checkout is enabled).

### Phase 3 — when approaching ~1k or multi-instance

8. Move auth users to Postgres (or add file locks + never run 2 web instances against JSON).
9. Login attempt counters / lockout beyond IP rate limits.
10. Admin Members: avoid full-list attribution work when only needing top N (already returns ≤200).

## Do not break while growing

- Keep `HEAVY_JOB_CONCURRENCY=1`, cheap `/ready`, Tier B hub GET (no sync rebuild).
- Do not enable fan digest unless deliberately staffed.
- Do not run two Render web instances against `users.json` until auth is DB-backed or flocked.

## Verify after Phase 1 deploy

```bash
curl -sS https://gatorvault-api.onrender.com/api/auth/store-status | python3 -m json.tool
# accountCount should match Admin Members
# Confirm GV_POINTS_PATH on Render if points should survive redeploy
```

Hammer check (staging): concurrent register + entitlement patch should not drop subscription fields.

## Related docs

- `docs/AUTH_ACCOUNT_PERSISTENCE.md` — durable users disk
- `docs/MEMBERSHIP_TRIAL_AND_EMAIL.md` — trial + drip
- `docs/ADMIN_HUB.md` — Pro memory / `/ready` / Tier B
