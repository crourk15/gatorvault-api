# iOS Codemagic backlog

**Policy:** Do **not** start Codemagic for every web change. App Store binary is bundled; live **API/data** already updates iOS without a rebuild. Batch UI-shell items here and build when the queue is worth a Codemagic wait.

See also: `docs/APP_WEB_DRIFT.md`

---

## Already live on iOS (no build needed)
- [x] Footprint Class 2028 commits: rev-gate + heal poisoned 0-commit runtime plates; lite warm refreshes footprint/commits on cron (API — no Codemagic)
- [x] 2027 Closing Class Top UF Targets soft plate (Tranard Roberts) — API
- [x] 2028 Priority Chase: purge UF alumni/roster/empty-ATH phantoms (Urban Meyer, Kyle Trask, Dallas Wilson, …) + hard-block — API
- [x] Early Discovery cards: durable rankings + live UF RPM overlay (fills composite/UF bars for allowlist shells) — API
- [x] Jamarcus Johnson 2028 DL Vault Scouting (Dexter Lawrence comp + projection) — War Room film desk upsert (API)
- [x] Prepared-meal player profiles — dossier stamps + live RPM overlay (API)
- [x] iOS member path: protect film-desk Pearl cards from beat sync clobber; restore Harris-Payne / West Vault Scouting; hide provisional drafts (API)
- [x] FutureCast master-board soft/disk seed — Lab primary never empty `status:building` on iOS (API)
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
- [x] Member first-touch attribution persist on `POST /api/register` + Admin Members Source/bySource (API) — live once any client sends `firstTouch`
- [x] 2028 HP seed refresh — Alderman locks Wilkes / McCary / Bailey / Hines on FutureCast Priority Chase (bundled seed; API)
- [x] Live depth chart API — `GET/PUT /api/roster/depth-chart` fall-camp board (web + post-Codemagic iOS content path)
- [x] FutureCast HP movement: hydrate 7d deltas from stamp history + ignore ancient baselines (API seed refresh)
- [x] Recruiting class counts: enrolled On3 signees no longer wiped by roster-collision block (2026 HS ~21, 2027 ~26) — API

---

## Waiting for next Codemagic build

Add a row when a change is **bundled client UI/JS** that iOS will not see until `ios-release` rebakes `client/out`.

| Added | Item | Why Codemagic | PR / commit |
|---|---|---|---|
| 2026-08-12 | Home Game Week elite card (ESPN logos + Days/Hrs/Min/Sec) + Signing Day stacked ESP/NSD tracker | `HomeCommandGameDay`, `SigningDayTracker`, home-wow + recruiting-hub CSS in binary | pending |
| 2026-08-12 | Priority chase board: kill On3 RPM / snapshot-delta / Updated jargon under title | `ClassTargetsPage.tsx` in binary | #419 + bake |
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
| 2026-08-08 | FutureCast Lab: harden trendingUp/Down nulls for SSG/deferred API stubs | `futurecast-lab-data` + Lab panels in binary (API soft plate also live) | #367 |
| 2026-08-08 | Silent first-touch UTM capture on landing → send with Join register | `first-touch-attribution.ts` + `FirstTouchCapture` + JoinPage in binary | pending |
| 2026-08-07 | FutureCast Lab: Closest to commit requires process evidence (offer/visits/intel), not On3 % alone | Leading panel + `competing-schools` gate in binary (API `processEvidence` also live) | pending |
| 2026-08-10 | Team depth chart reads live `/api/roster/depth-chart` (camp updates without rebuild after this bake) | `team-hub-api`, `depth-chart-api`, Vault/Team depth pages in binary — **content** stays API/data after ship | pending |
| 2026-08-10 | FutureCast Lab accuracy: credible-rival Who commits next scoring + Early Discovery load hardening | `competing-schools.ts`, `FutureCastLeadingPanel`, `EarlyDiscoveryPreview` in binary (HP movement/API also live) | pending |
| 2026-08-11 | Recruiting Footprint Class 2027/2028 tabs: fall back to year bundle when `/hub/footprint` soft-misses | `recruiting-hub-elite-api.ts` + `RecruitingFootprintMap` in binary (API footprint seed from bundle also live) | pending |
| 2026-08-11 | Recruiting Footprint year tabs: remove `onMouseDown preventDefault` that drops iOS WKWebView clicks | `RecruitingFootprintMap.tsx` + tab `touch-action` CSS in binary | pending |
| 2026-08-12 | 2028 chase cards v12: Current Class chrome + Why we chase (home Targets, Lab Priority chase, HP board) | `VaultChaseCard`, `TargetBoardPreview`, `HighPriorityTargetCard`, `FutureCastChaseCard` + CSS in binary | pending |
| 2026-08-12 | FutureCast Big Board: rename Top Targets tab → **Best Fits** (scheme fit board, not Priority Chase) | `FutureCastBigBoardPage` + big-board routes in binary | pending |
| 2026-08-12 | My Alerts: Board Intel seed refresh + default method Both/Instant so Save registers email | `alerts-hub-seed`, `VaultAlertsPage`, `alert-prefs` in binary (API visit fanout/soft path also live) | pending |
| 2026-08-12 | Film-tier shells: Game Week depth blur, Vault Scouting blur, 2029–30 early board; trial unlocks Film | `VaultGameWeekPage`, `GameWeekCommandCenter`, `VaultScoutingSection`, `FutureCastExtendedModules`, `futurecast-insider` in binary (API trial=Film also live) | pending |
| 2026-08-12 | Priority Chase stamps: always `#N Chase` + Rising badge (not Rising replacing rank) | `VaultChaseCard` + CSS in binary | pending |
| 2026-08-12 | Beat Writer Highlights: diversify writers / exclude brand Live filler on home + GNL | `gatornation-live-api`, `home-command-utils`, `HomePremiumPage` in binary (API `pickBeatHighlightPosts` also live) | pending |
| 2026-08-12 | My Alerts: **Send test alert** fires Brysen OV email + push to signed-in account | `VaultAlertsPage`, `alert-email-api` in binary (`POST /api/alerts/send-visit-alert` also live) | pending |
| 2026-08-12 | Lab Priority chase: full VaultChaseCard on surface (same HP board cards; kill ModuleShell/flex clip) + FAB/safe-area | `FutureCastTargetsPanel`, `HighPriorityTargetCard`, `vault-chase-card.css`, Lab/RH CSS in binary | pending |
| 2026-08-12 | Fix Lab/chase scroll fight + UI leakage: restore module overflow, hide Live Pulse FAB on Lab/chase, document scroll | `LivePulseFab`, `gv-ui-cleanup`, `recruiting-hub-command-center.css` in binary | pending |
| 2026-08-12 | FutureCast Big Board: Vault cards for Intelligence Rank / Best Fits / Early Discovery (retire ClassicRecruitCard) | `VaultBigBoardCard` + grids in binary | pending |
| 2026-08-12 | Big Board vault cards: keep 3-up metric strip on 375px + Portal/Predictions/Related on VaultBigBoardCard | `vault-chase-card.css`, Portal/Prediction/RelatedPlayers in binary | pending |
| 2026-08-12 | Vault card chrome: match FC chase/BB cards to recruiting commit heat (opaque blue wash + orange rail) | `vault-chase-card.css` + elite commit heat CSS in binary | pending |
| 2026-08-12 | Chase scroll/FAB leakage: document scroll for Lab + recruiting targets board; kill module overflow:visible; hide FAB on priority | `LivePulseFab`, `gv-ui-cleanup`, `mobile-native-framework`, `vault-shell` in binary | pending |
| 2026-08-12 | Kill sticky Lab/RH module heads + platform vault document scroll (Who commits next stuck) | `mobile-native-framework`, `gv-ui-cleanup`, `vault-shell`, Leading bare on 2028 | pending |
| 2026-08-12 | Priority chase UI leakage: restore ModuleShell plate + dark title; un-nest Share climate; chase overflow:visible | `FutureCastTargetsPanel`, lab/mobile CSS in binary | pending |

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
