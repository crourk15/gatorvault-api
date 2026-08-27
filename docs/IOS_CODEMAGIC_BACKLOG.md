# iOS Codemagic backlog

**Policy:** Do **not** start Codemagic for every web change. App Store binary is bundled; live **API/data** already updates iOS without a rebuild. Batch UI-shell items here and build when the queue is worth a Codemagic wait.

See also: `docs/APP_WEB_DRIFT.md`

---

## Already live on iOS (no build needed)
- [x] Tranard Auburn UV: hub serve scrub + ticker cacheRev t9 + durable players heal — Home NOW/movement cannot replay stone from disk/CDN (API; no Codemagic)
- [x] Tranard Roberts: hard-scrub false Auburn unofficial visit from players.json + store normalize/merge + intel buildVisits + visit-log ingest (On3 cannot reintroduce) — API
- [x] HP stale-DISK rebuild + warm force bypass (`DISK-STALE` / cache v40) — FutureCast chase/delta7d unfreeze after Render (API)
- [x] Why we chase generator + Admin/script overrides on HP API (`whyWeChase`) — live after Render; **client prefer-field needs Codemagic bake below**
- [x] 2028 HP chase cards: visit lines + Why we chase notes from live visit/intel stores + soft priority nudge (API — no Codemagic; Rising still snapshot `delta7d` only)
- [x] Home NOW / class-overview 2027 commit count lockstep with commit cards (26) — kill protected-only phantom inflate + shared `loadHubHsClassCommits` (API)
- [x] App Store **1.0.20** approved — pre-release train closed; next bake is **1.0.21** / build 86+
- [x] App Store **1.0.19** approved — prior train
- [x] App Store **1.0.18** approved — prior train (`90186` / `90062`)
- [x] App Store **1.0.17** accepted / eligible for distribution (Aug 17, 2026) — submission `702dcbe4-cab3-4b26-a8ff-5a329d3a6d27`
- [x] Film Room Press Conferences: same-day speaker re-uploads / search mirrors collapsed (Sumrall Aug 4 + Media Days) — API + cache dedupe on sync/serve
- [x] Gabriel profile Field/On3 Florida 100: stamp overlay treated residual ufRpmPct 1 as fraction×100 — parseRpmPct + live topTeams peers (API)
- [x] Gabriel Player Field/GV poison: On3 Florida crumb 0.80% was ×100 → Field 80 / GV ~85 while Miami owns ~94% — board-aware scale + HP heal + store ufRpmPct=1 (API)
- [x] HP heal no longer sync-parses players.json on request path (was starving Render /ready past 5s under HP no-store load) — API
- [x] HP board-truth guard: durable `/var/data` merges fresher On3 topTeams/ufRpm from git bundle; heal falls back to bundle; audit script `audit-hp-board-truth.js` — API (Closest client offer gate needs Codemagic)
- [x] App Store **1.0.15** accepted / eligible for distribution (Aug 14, 2026) — member announce email path live via Admin Hub
- [x] Jaxen Cepeda 2028 OT Vault Scouting (Dalton Risner comp) + allowlist seed after Florida offer/game-day visit — API
- [x] Full-profile stamps overlay live On3 Industry ranks (Wright #1 not baked #208) — API
- [x] 2028 allowlist intel continuous coverage (Wilkes/McCary/Bailey/Hines/Jamarcus) + chase process logs — API / recruiting-light sweep
- [x] Home NOW ticker lines: named movement + lite-warm `/hub/ticker` refresh (API — no Codemagic)
- [x] Footprint Class 2028 commits: heal poisoned `bundle.footprint` nest from dedicated plate on serve (API — open-cycle map no longer stuck at 0)
- [x] Open Class 2028 HP soft plate — Tier B cold miss never empty `status:building` for targets / Priority Chase (API)
- [x] Footprint Class 2028 commits: rev-gate + heal poisoned 0-commit runtime plates; lite warm refreshes footprint/commits on cron (API — no Codemagic)
- [x] DeNairo Girton Jr. 2028 S Vault Scouting (Jessie Bates III comp) — correct Great Mills MD identity (Beat Desk had Tramond Collins On3 collision) — API
- [x] Tranard Roberts profile: Vault Scouting (Judkins comp) + heal predictedSchool / htWt / Georgia phantom rival — API + prepared-meal stamp
- [x] Josiah Taylor: UF Fit 99 was On3 UF% poisoned into `ufFitScore` — heal stamp overlay to recruiting Fit (~55); RPM stays on odds — API
- [x] 2027 Closing Class Top UF Targets soft plate (Tranard Roberts) — API
- [x] 2029 early targets: On3/Rivals Power Top 100 ranks/pos/stars + FL Top 100 adds; Names to know soft plate (API — chase-style cards need Codemagic)
- [x] 2028 Priority Chase: purge UF alumni/roster/empty-ATH phantoms (Urban Meyer, Kyle Trask, Dallas Wilson, …) + hard-block — API
- [x] Early Discovery cards: durable rankings + live UF RPM overlay (fills composite/UF bars for allowlist shells) — API
- [x] Jamarcus Johnson 2028 DL Vault Scouting (Dexter Lawrence comp + projection) — War Room film desk upsert (API)
- [x] Prepared-meal player profiles — dossier stamps + live RPM overlay (API)
- [x] iOS member path: protect film-desk Pearl cards from beat sync clobber; restore Harris-Payne / West Vault Scouting; hide provisional drafts (API)
- [x] FutureCast master-board soft/disk seed — Lab primary never empty `status:building` on iOS (API)
- [x] Lab polish API — null stars, Early Discovery soft cold-miss, capped warm workers (API)

These ship via Render / Netlify API — current App Store binary (1.0.18) picks them up:

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
- [x] Member signup channel — Website vs iOS app on register + Admin Members Channel / byChannel rollup (API + Hub; web Netlify client; iOS bake for in-app Join)
- [x] Member first-touch attribution persist on `POST /api/register` + Admin Members Source/bySource (API) — live once any client sends `firstTouch`
- [x] 2028 HP seed refresh — Alderman locks Wilkes / McCary / Bailey / Hines on FutureCast Priority Chase (bundled seed; API)
- [x] Live depth chart API — `GET/PUT /api/roster/depth-chart` fall-camp board (web + post-Codemagic iOS content path)
- [x] FutureCast HP movement: hydrate 7d deltas from stamp history + ignore ancient baselines (API seed refresh)
- [x] Recruiting class counts: enrolled On3 signees no longer wiped by roster-collision block (2026 HS ~21, 2027 ~26) — API
- [x] 2026 Game Week uniform schedule (helmet/jersey/pants per game from `@GatorsFB` lineup) — API `/api/schedule` (matchup hero strip needs Codemagic)

---

## Waiting for next Codemagic build

**Next bake target: App Store `1.0.21` / build `86+`** (`MARKETING_VERSION` in `project.pbxproj`). See `docs/APP_STORE_1_0_21_BUILD86.md`.

Add a row when a change is **bundled client UI/JS** that iOS will not see until `ios-release` rebakes `client/out`.

| Added | Item | Why Codemagic | PR / commit |
|---|---|---|---|
| 2026-08-26 | Community: Edit + Delete on own threads/replies (author-only) | `VaultCommunityPage` + `CommunityPostActions` + community-api in binary; **API routes live without bake** | pending |
| 2026-08-26 | Capacitor seed: scrub movementFeed visit/offer school lines (Tranard Auburn + rival offers) — only live ticker/alerts paint schools | `recruiting-hub-bundle-seed` in binary | pending |
| 2026-08-26 | Home NOW: hard 3-week cap + Florida offer requires real offer day; ticker disk cacheRev t8 | pulse gates in binary; **API ticker/alerts live without bake** | pending |
| 2026-08-26 | Home NOW: drop stale/undated offers + rival offer spam (14d offer day) | pulse offer gate in binary; **API ticker/alerts live without bake** | pending |
| 2026-08-26 | Home NOW: compress article blurbs to finished chips (no mid-word …) | pulse prose compress in binary; **API alerts sanitize live without bake** | pending |
| 2026-08-26 | Home NOW: visit lines only if ≤21d (or upcoming) — drop stale Tranard-style UOVs | pulse visit timestamp gate in binary; **API ticker/alerts live without bake** | pending |
| 2026-08-26 | Home NOW elite curation (rank Florida visits/class heat; merge chase ticker; cap offer spam) | `HomePremiumPage` + pulse ranking in binary; **API ticker/alerts live without bake** | pending |
| 2026-08-26 | Home NOW: strip allowlist “on file” offer/visit copy + 1-commit grammar | `home-command-utils` pulse in binary; **API sanitize live without bake** | pending |
| 2026-08-25 | Home NOW: strip Beat Desk / allowlist-intel ops copy (Staff note, from player card) — fan process language only | `home-command-utils` + pulse in binary; **API ticker/alerts sanitize live without bake** | pending |
| 2026-08-25 | Home NOW: strip visit/offer school lines from Capacitor seed (Tranard Auburn stone) — named visits only from live `/hub/ticker` | `HomePremiumPage` + `recruiting-hub-bundle-seed` in binary; live ticker already Florida | pending |
| 2026-08-24 | Community: show member display name on open thread + list (not generic “Member”) | `VaultCommunityPage` + `community-api` + CSS in binary; API nests `thread.author` on detail | pending |
| 2026-08-23 | Why we chase: prefer live API `whyWeChase` (Admin-editable anytime after this bake); nugget voice fallback — no hometown / no score dumps | `VaultChaseCard` + `chase-priority` + HP map in binary; API generator/overrides already live without bake | pending |
| 2026-08-23 | Why we chase: explain chase rank (talent + board/priority/process) — never hometown as the reason; pass `#N` into brief | `chase-priority` + `VaultChaseCard` in binary | pending |
| 2026-08-23 | Game Week matchup hero: Helmet / Jersey / Pants color chips for this week’s uniform | `MatchupHeroWidget` + `uf-uniform-colors` + GW CSS in binary | pending |
| 2026-08-23 | Where Florida needs help: depth-ok rooms stay In good shape — no Needs help from 2 departing seniors alone | `fc-position-need-board` + Lab position breakdown in binary | pending |
| 2026-08-23 | Why we chase: thin room only for trench/CB gaps at need ≥85 — never WR/RB/TE from weight table alone | `chase-priority` thin-room gate in binary | pending |
| 2026-08-23 | Why we chase: truth-first voice — claim thin room only when need is real; elite talent can chase with room set; named place never “backyard” | `chase-priority` `buildChaseWhyBrief` + `nationalRank` on Lab target in binary | pending |
| 2026-08-23 | Why we chase: never mid-sentence note clips (`and is…`) — compress visit/offer prose to short Vault chips | `chase-priority` in binary; API `truncateNote` also live | pending |
| 2026-08-23 | Why we chase: richer lead (thin room + Fit) + process `notePreview` tails; ~180 char cap; still no film traits | `chase-priority` `buildChaseWhyBrief` + chase tests in binary | pending |
| 2026-08-23 | Community iOS org: post→open thread, default Recent, Staff open vs Member threads, category tabs, hide duplicate Spark/Staff on mobile | `VaultCommunityPage`, `community-api`, `community-elite.css` in binary | pending |
| 2026-08-20 | Signup channel: send `signupChannel` / `X-GV-Client` (website vs ios) on register so Admin Members can split web vs app | `auth-api` Join/register in binary; **API + Admin Hub already live for web Netlify** | pending |
| 2026-08-20 | Footprint Class 2028: client falls back to dedicated `/hub/footprint` when bundle nest shows 0 commits but commit cards exist | `useHubBundleSection` in binary; **API heal of `bundle.footprint` nest is live without bake** | pending |
| 2026-08-18 | Game Week matchup hero: official 2026 uniform combo (helmet/jersey/pants) from `@GatorsFB` lineup | `MatchupHeroWidget` + `game-week-wow` CSS + schedule JSON in binary | pending #502 |
| 2026-08-17 | Chase On3 lead stamp from API (`on3Lead`) — prefer server field so stamp bugs/prediction swings are Render-only after this bake | `VaultChaseCard` + HP cache v20 in binary; API stamps `on3Lead` on every HP serve | pending |
| 2026-08-17 | Chase On3 lead labels: ND / Miss St / SC / TTU / NC State (no more "Notre"/"South"/"Texas" for Tech) | `competing-schools` + `VaultChaseCard` in binary | pending |
| 2026-08-17 | Chase On3 lead: treat FSU/USF/FAU as rivals (not UF); keep real ~95% favorites in chrome | `competing-schools` in binary; API peer extract + HP disk heal also live | pending |
| 2026-08-17 | HP localStorage cache v19 (Gabriel Field 0.80→80 / GV 85 bust) | `futurecast-high-priority-api` in binary; API heal + store ufRpm=1 already live | pending |
| 2026-08-17 | Closest/Chase: drop fake 100% peer On3 leads when a mid-board rival exists (Asher OSU crumb); HP localStorage cache v18 | `competing-schools` + `futurecast-high-priority-api` in binary; API no-store + heal already live | pending |
| 2026-08-17 | Closest: sole-board fake Florida lock without UF offer cannot rank (Girton disk poison); real sole locks with offers still eligible | `competing-schools` in binary; API board-truth merge/heal also live | pending |
| 2026-08-17 | Closest / Who commits next: industry-trailing residual RPM (Jernigan) cannot invent Florida lead; client `sanitizeRpmPct` accepts 1% | `competing-schools`, `uf-odds-scale` in binary; HP odds heal is API | pending |
| 2026-08-17 | Articles hub: Authors + Tags filter Latest + live counts/tags from published articles (no fake 48/32/21) | `InsiderArticlesPage` + insider-api/data + insider-hub CSS in binary; API authors/tags also live | pending |
| 2026-08-17 | Articles hub: remove duplicate Related rail (Related stays on article reader only); Latest list labeled | `InsiderArticlesPage` in binary | pending |
| 2026-08-17 | Game Week: dedicated **Expected visitors** panel (name/pos/school → profile); visitors removed from 3 Keys | `ExpectedVisitorsPanel` + Command Center in binary; list data stays API (`game-visitors-2026.json`) | pending |
| 2026-08-16 | Chase card: dedicated Expected visit line above Why we chase + skip HP SWR | `VaultChaseCard` / SWR in binary | pending |
| 2026-08-16 | Chase card Why we chase: show Expected FAU/Ole Miss visit labels from HP visitHistory | `chase-priority` `buildChaseWhyBrief` in binary (API visitHistory live without bake) | pending |
| 2026-08-16 | Game Week schedule: always await live `/api/schedule` (skip SWR cache-first) so Expected visitors / keys update without hard refresh | `schedule-api`, `stale-while-revalidate` in binary — **Netlify picks up web; iOS needs bake** | pending |
| 2026-08-16 | My Alerts Board Intel copy: “recent (~3 weeks)” visits — older UVs/OVs drop via API already | `VaultAlertsPage` hint in binary | pending |
| 2026-08-16 | My Alerts Board Intel: show verified UV visits + fix upcoming “Just now” timestamp | `VaultAlertsPage`, `alert-fan-copy` in binary (API row types live without bake) | pending |
| 2026-08-16 | Gators Live ready copy: drop member-facing “don’t ping live APIs” jargon; scoreboard-window wording only | `VaultLiveScoresPage` in binary | pending |
| 2026-08-15 | Home NOW: never bake commit/signee counts in Capacitor seed — strip stone lines; rewrite from live class-overview on load (commit/decommit = API only after this bake) | `HomePremiumPage`, `home-command-utils`, `recruiting-hub-bundle-seed` in binary | pending |
| 2026-08-15 | Home NOW 2027 commit count: seed/hub-runtime said 25; live is 26 (Keumajou class-year fix + ticker/class-overview use same filtered count) | hub-runtime 2027 + players.json — **API live**; seed stone fixed by row above | pending |
| 2026-08-15 | Game Week Command Center reads live `/api/schedule` for Intel/Film Notes/Scouting (drop FAU_BUNDLE); `defenseTendencies` + correct offense/defense scouting map; weekly film updates are JSON/API-only after this bake | `GameWeekCommandCenter`, `SeasonTimeline`, `game-week-data`, schedule JSON in binary — **content** stays API/data after ship | pending |
| 2026-08-15 | Player profile: faster load + tabs no longer cover Vault Scouting on scroll (compact wrap row, not sticky column) | `usePlayerProfileRoute`, `VaultPlayerProfileRoute`, profile/mobile CSS in binary — **1.0.16 / build 81** | #444 + version bump |
| 2026-08-12 | Signing Day ESP/NSD: scope lists to active class year (?year=2028) | `SigningDayPage` + signing-day-utils links in binary | pending |
| 2026-08-12 | Home NOW pulse: rotate live ticker/intel stories (not frozen class-trending line) | `HomeCommandCenter`, `HomePremiumPage`, pulse utils in binary (API ticker also live) | pending |
| 2026-08-12 | ESP Expected signees: UF commits only (kick Flip Watch off the list) | `SigningDayPage` + `signing-day-utils` in binary | pending |
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
| 2026-08-13 | 2026 schedule live API: Oklahoma + @ Kentucky + `/api/schedule` fetch (after this bake, slate edits are JSON/API-only — no Codemagic) | `schedule-api`, SchedulePageShell, SeasonTimeline, `schedule-board` seed in binary | pending |
| 2026-08-13 | Schedule: UGA → Mercedes-Benz Atlanta + per-game ticket event deep links (Official/TickPick/StubHub) | `schedule-premium`, GameActions, schedule seed/CSS in binary | pending |

---

## When you decide to build

1. Confirm backlog rows above are still wanted.
2. Codemagic → **ios-release** on `main` (or GitHub Action **iOS TestFlight**).
3. Install TestFlight → verify each backlog row.
4. Clear this table (move rows to “Shipped in build …”) and bump version notes.

## Shipped in App Store builds

| Build | Shipped |
|---|---|
| 1.0.19 (approved Aug 23, 2026) | Community, Why we chase truth-first + thin-room, Where Florida needs help, Game Week uniform color chips, chase/visit polish from 1.0.18 queue |
| 1.0.12 (accepted Aug 5, 2026) | Baseline — pre-backlog |
