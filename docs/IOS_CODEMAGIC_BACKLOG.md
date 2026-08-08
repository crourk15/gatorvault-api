# iOS Codemagic backlog

**Policy:** Do **not** start Codemagic for every web change. App Store binary is bundled; live **API/data** already updates iOS without a rebuild. Batch UI-shell items here and build when the queue is worth a Codemagic wait.

See also: `docs/APP_WEB_DRIFT.md`

---

## Already live on iOS (no build needed)
- [x] Prepared-meal player profiles — dossier stamps + live RPM overlay (API)
- [x] Lab polish API — null stars, Early Discovery soft cold-miss, capped warm workers (API)

These ship via Render / Netlify API — current App Store binary (1.0.12) picks them up:

- [x] FutureCast commit likelihood (live HP / GV odds)
- [x] Official 2026 roster jersey numbers + newcomers (API)
- [x] Elite API Tier B — hub/Lab GET no-sync rebuild + warm-memory cron (API)
- [x] Recruiting card brief without `Vault Eval —` API prefix
- [x] Film Room / Sumrall Aug 4 pressers (after stay-green lift + sync)
- [x] Stay-green lifted — beat / Film Room / recruiting crons running again
- [x] 2027 commit War Room Vault Scouting on **player profiles** (comp/projection/traits)
- [x] Commit hub cards: API no longer sends Vault Comp / Vault Projection (brief only — matches 2028; iOS hides empty slots)
- [x] FutureCast / profile speed: War Room cache, full-profile SWR cache, slim related peers, keepalive Lab warm (API)
- [x] Commit card surface unison: short “committed to Florida” line for all class years (API)
- [x] FutureCast Closest to commit: 2028 high-priority API returns full allowlist (not chase-hot top-18 cut) so board leaders like Hudson West update live on iOS
- [x] Vault Scouting: provisional / `filmWatched:false` evals hidden from fan profiles (Harris-Payne film-watch standard) — API gate
- [x] FutureCast Closest processEvidence on HP API (offer/visits/intel flags) — live on iOS for payload; stamp gate needs client bake below

---

## Waiting for next Codemagic build

Add a row when a change is **bundled client UI/JS** that iOS will not see until `ios-release` rebakes `client/out`.

| Added | Item | Why Codemagic | PR / commit |
|---|---|---|---|
| 2026-08-05 | Recruiting commit cards: remove orange **Vault Eval** CSS label (untitled brief) | `EliteCommitCard.tsx` + CSS in binary | #326 |
| 2026-08-05 | Recruiting commit cards: remove Vault Comp / Vault Projection slots from card JSX (profile-only) | `EliteCommitCard.tsx` in binary (API already nulls fields) | pending |
| 2026-08-05 | Profile route: prefetch full-profile in parallel with resolve | `usePlayerProfileRoute.ts` in binary | pending |
| 2026-08-05 | Team roster cards: show **#jersey** next to position | `RosterList.tsx` + TeamPlayer.jersey mapping in binary | #325 |
| 2026-08-05 | FutureCast Lab seed/cold-paint: normalize `ufConfidence` → `ufProbability` | Baked `futurecast-lab-seed` + Lab hook in binary (live API path already works) | #325 |
| 2026-08-06 | Elite recruiting surfaces: compact commit-card heat (pos mark + stamp), chase initials mark, profile Stand-hero → Vault Scouting → demoted dossier | `EliteCommitCard`, `OverviewFourSlot`/`OverviewTab`, HP card + CSS in binary | #337 |
| 2026-08-06 | FutureCast Lab fail-fast fetches when API hard-down (shorter warm poll) | `futurecast-lab-data.ts` in binary | #337 |
| 2026-08-06 | FutureCast Lab: Next commits board (GV closer score + aligned rows) above Priority chase; Share climate copy | Lab panels + CSS in binary | #337 |
| 2026-08-06 | Player Share: `/share/player/:slug` OG URL + Mail-safe subject/body (no bare-URL subject) | `PlayerHeader` + `buildPlayerShareUrl` in binary | #337 |
| 2026-08-06 | FutureCast Lab: ink-color unison (Who commits / Needs help) + Priority chase rank/why cards + Open board link | Lab panels + CSS in binary | #337 |
| 2026-08-06 | Film Room shell refresh: owned hero, hub rail counts, featured + thumbnail grid, hub label normalize | `VaultFilmRoomPage` + CSS in binary | #337 |
| 2026-08-06 | Film Breakdown: drop GNFP Podcast / Talking Ball coach sit-downs from seed + client catalog filter | `film-room-hub-seed` + `film-room-api` in binary (API prune also live) | pending |
| 2026-08-07 | FutureCast Lab: Closest to commit requires process evidence (offer/visits/intel), not On3 % alone | Leading panel + `competing-schools` gate in binary (API `processEvidence` also live) | pending |

---

## When you decide to build

1. Confirm backlog rows above are still wanted.
2. Codemagic → **ios-release** on `main` (or GitHub Action **iOS TestFlight**).
3. Install TestFlight → verify each backlog row.
4. Clear this table (move rows to “Shipped in build …”) and bump version notes.

## Shipped in App Store builds

| Build | Shipped |
|---|---|
| 1.0.12 (accepted Aug 5, 2026) | Baseline — pre-backlog |
