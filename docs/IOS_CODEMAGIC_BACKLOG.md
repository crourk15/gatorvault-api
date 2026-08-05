# iOS Codemagic backlog

**Policy:** Do **not** start Codemagic for every web change. App Store binary is bundled; live **API/data** already updates iOS without a rebuild. Batch UI-shell items here and build when the queue is worth a Codemagic wait.

See also: `docs/APP_WEB_DRIFT.md`

---

## Already live on iOS (no build needed)

These ship via Render / Netlify API — current App Store binary (1.0.12) picks them up:

- [x] FutureCast commit likelihood (live HP / GV odds)
- [x] Official 2026 roster jersey numbers + newcomers (API)
- [x] Recruiting card brief without `Vault Eval —` API prefix
- [x] Film Room / Sumrall Aug 4 pressers (after stay-green lift + sync)
- [x] Stay-green lifted — beat / Film Room / recruiting crons running again

---

## Waiting for next Codemagic build

Add a row when a change is **bundled client UI/JS** that iOS will not see until `ios-release` rebakes `client/out`.

| Added | Item | Why Codemagic | PR / commit |
|---|---|---|---|
| 2026-08-05 | Recruiting commit cards: remove orange **Vault Eval** CSS label (untitled brief) | `EliteCommitCard.tsx` + CSS in binary | #326 |
| 2026-08-05 | Team roster cards: show **#jersey** next to position | `RosterList.tsx` + TeamPlayer.jersey mapping in binary | #325 |
| 2026-08-05 | FutureCast Lab seed/cold-paint: normalize `ufConfidence` → `ufProbability` | Baked `futurecast-lab-seed` + Lab hook in binary (live API path already works) | #325 |

---

## When you decide to build

1. Confirm backlog rows above are still wanted.
2. Codemagic → **ios-release** on `main` (or GitHub Action **iOS TestFlight**).
3. Install TestFlight → verify each backlog row.
4. Clear this table (move rows to “Shipped in build X”) and bump version notes.

### Shipped in App Store builds

| Build | Shipped |
|---|---|
| 1.0.12 (accepted Aug 5, 2026) | Baseline — pre-backlog |
