# GatorVault Admin Hub

Canonical ops console for GatorVault. **Not part of the iOS App Store review surface.**

## URLs

| URL | Purpose |
|---|---|
| `/admin/hub` | Unified Admin Hub (preferred) |
| `/admin` | Same shell as hub |
| `/admin/login` | PIN login → redirects into hub |
| `/vault/admin` | React stub that redirects to `/admin/hub` |

Legacy bookmarks (`/admin/ops`, `/recruiting-admin.html`, etc.) redirect into hub hash routes.

**Default landing:** `#beat-desk/desk`

## Operator Notecards (Charles mode)

Plain-English playbook cards on **Beat Desk** and **Command Center**:

- **Do this now** — numbered daily steps
- **If red / yellow — do this** — concrete next steps (STALE vs FAIL vs kitchen waking vs Film Room catalog vs sidebar red)
- **Red tile playbook** — Top Issue strip + Full Ops cards show a yellow **What to do** line and an orange fix button (ex: **Rebuild Film Room catalog**), not just “Open module”
- **Coach says** (Command Center) — elementary-English explanation of the current Top Issue (what it means, numbered steps, what not to worry about)
- **Clear the red** — sticky green button on every page; wakes server and runs safe fix jobs for real reds (Film Room, recruiting, etc.)
- **Go post** — default when nothing actionable is red; wake-lag / latency-only API is yellow (ignore) so Charles isn’t blocked from Beat Desk
- **Wake lock** — while the server is waking, Deploy recovery stays disabled (spamming it makes fail noise)
- **API status light** — top-right pill is always visible: **green API OK** / yellow API waking / **flashing red API DOWN**. Click to recheck. Soft orange banner = kitchen waking (503). **Flashing red banner + ops strip + `[API DOWN]` tab title** = Render 502/504 — App Store / War Room login will fail until `gatorvault-api` is restarted/redeployed. Do not treat red as “just waking.”

### Elite API stability (keep every product job)

Heavy work (On3, beat ingest, allowlist-intel, hub refresh/warm, Film Room YouTube) is **queued**, not disabled. Overlap waits its turn so members still get every feature while `/ready` stays green. Look for `[heavy-job-gate] start|done` in Render logs. Do **not** re-enable stay-green / strip crons to “stabilize.”

**Tier B (request path):** Hub + FutureCast Lab **GETs never sync-rebuild**. They serve memory → stale → durable `hub-runtime` / deploy snapshot, and return `status: building` only on a true cold miss. Refill is owned by:

- **Boot:** `HUB_BOOT_FORCE_WARM=true` — priority-**lite** (hero/class) first, then **spaced elite fill** (HP → sequential bundle → master-board) with large gaps so Starter does not OOM
- `POST /api/recruiting/hub/warm-memory?mode=spaced` (cron `gatorvault-api-hub-warm`, every ~25m; Admin PIN also works). Modes: `lite` | `spaced`/`elite` | `bundle`
- `POST /api/futurecast/lab-warm` (Admin PIN / optional; spaced warm owns HP + master on cron)
- `POST /api/recruiting/hub/refresh?warmAfter=priority` (cron `gatorvault-api-hub-refresh`)

**Prepared-meal profiles:** `GET /api/player/full-profile/:slug` serves durable dossier stamps first (`X-Profile-Cache: STAMP`) — identity, War Room vault scouting, tape, ranks — and overlays **live On3/RPM + live Vault Scouting**. Roster meals stay on `roster/players.json` via resolve (stats land there later). Re-stamp allowlist: `node --import tsx server/scripts/stamp-player-profiles.js --write-bundle`. Env: `PROFILE_STAMP_FIRST` (default on).

**Vault Scouting (iOS):** Film-desk Pearl cards (`filmWatched:true` / Vault film desk verified) are protected from beat `scouting-database` sync clobber. Provisional drafts (`PROVISIONAL` / `filmWatched:false`) stay hidden from fans. Master-board GETs soft-serve disk/`hp_soft_seed` so Lab never sticks on empty `status:building`.

Lab polish: unknown stars are `null` (not `0★`); Early Discovery cold miss serves allowlist soft payload (no Loading…); workers use capped heap. Lab HP: Pro 4GB runs spaced child-worker refresh (`HUB_SPACED_WARM_LAB=true`) and writes durable leftovers; bundled `futurecast-runtime` seed is emergency backup only. Spaced steps **release hub memory** (disk fallback) before bundle/HP, then restore lite. Look for `[recruiting-hub] boot priority-lite warm` / `primed Lab HP from seed` / `spaced elite fill queued` / `spaced step` / `warm-memory` in Render logs. Env knobs: `HUB_GET_NO_SYNC_BUILD`, `FC_GET_NO_SYNC_BUILD`, `HUB_BOOT_FORCE_WARM`, `HUB_SPACED_ELITE_WARM`, `HUB_SPACED_WARM_YEARS` (default `2028`), `HUB_SPACED_WARM_LAB`, `HUB_SPACED_WARM_GAP_MS` (code floor ≥240s), `HUB_SPACED_WARM_START_MS` (code floor ≥180s), `HUB_SPACED_WARM_MASTER` (opt-in), `HUB_BUNDLE_SEQUENTIAL`, `HUB_SPACED_WARM_FORK` (child-process warm; HP worker loads `tsx`). Stale Render dashboard values below the floors are ignored.
- **App Store gate** — internal 7-day stability checklist (QA + Product Health ≥ 90). Codes like `product_intel_below_90` mean the vault scorecard is under 90 — **not** a message from Apple / App Store Connect
- **What the buttons mean** — Open / Copy Brief / Refresh / etc.
- **Don’t touch** — Legacy consoles + calm guidance for “kitchen waking”

Beat inbox legend: **LIVE** = fresh · **STALE** = older than 24h (still OK to Open) · **FAIL** = Check API / Refresh.

Collapse/expand is remembered for the browser session (`Show notecards` / `Hide notecards`).

## Freeze boundary (App Store review)

Safe to change while an iOS build is in review:

- `server/admin*.html`, `server/js/admin-hub*.js`, `server/js/admin-embed.js`
- `server/lib/admin-hub-routes.js`, `server/lib/admin-pin.js` (admin-only)
- Netlify static publish of admin assets

Do **not** couple Admin Hub work to:

- Vault membership / IAP / account deletion
- App Review demo credentials
- iOS binary / Codemagic / App Store Connect
- Breaking changes to customer-facing vault APIs

## Auth model

Hub login accepts configured operator env pins **and** legacy `GV2026admin` (cron secrets alone do not lock out the legacy PIN). Set `DISABLE_DEFAULT_ADMIN_PIN=true` only when you intentionally want env-only pins.

1. Operator enters PIN on `/admin/login`.
2. PIN is stored in `sessionStorage` (`gv_admin_pin` / `gv_ops_pin`).
3. Hub API calls send `X-Ops-Pin` / `X-Recruiting-Pin` headers (not query strings).
4. Iframe embeds receive PIN via same-origin `sessionStorage` + `postMessage` to `location.origin` — **PIN is not appended to iframe URLs**.

Accepted pins come from env vars (`OPS_ADMIN_PIN`, `ADMIN_PASSWORD`, `RECRUITING_ADMIN_PIN`, …).  
Set `OPS_ADMIN_PIN` in Render for production.

## Primary in-shell panels

| Panel | Route | Role |
|---|---|---|
| **Beat Desk** | `#beat-desk/desk` | Daily loop — Open → packet → Copy Brief → X (+ FutureCast feed card) |
| **Command Center** | `#dashboard/overview` | Health, top issues, pipelines |
| **Runbooks** | `#dashboard/runbooks` | Preset ops flows (also replaces old GM re-run tab) |
| **Ops Summary** | `#dashboard/ops-summary` | Tiles, cron freshness, safe re-runs |
| **Job Queue** | `#dashboard/jobs` | Safe re-runs + heartbeats + recent ops logs |
| **Post Studio** | `#dashboard/post-studio` | Advanced inbox/drafts (secondary to Beat Desk) |
| **Members** | `#members/recent` | Newest signups: trial / paid / expired |
| **FutureCast** | `#futurecast/control` | Targets, 2028 admin allowlist add/remove, early watch |
| **Recruiting Daily** | `#recruiting/daily` | Events, ingest, pipeline |
| **Unresolved Predictions** | `#recruiting/unresolved` | Nameless RPM teasers |
| **Roster & Board** | `#team/board` | In-shell board editor + Vault Grades |
| **QA / Product summaries** | `#qa/summary`, `#product-intel/summary` | In-shell digests |
| **Settings** | `#settings/platform` | Points, tiers, rebuild tools, PIN env reference (no feature-flag UI) |

Sticky **Activity** rail — recent `/api/ops/logs` + local hub actions.

Inline panels **re-render on every visit** so Beat Desk / Command Center / FutureCast stay fresh.

## Legacy consoles (iframe escape hatches)

Nav section marked **Legacy consoles**:

- Content & Media
- Community Admin
- Feedback & Support
- Player Intel Entry (prefer Beat Desk for daily intel → board)
- Self-Runner

Full Ops / Full QA iframes remain under Dashboard / QA as escape hatches.

## FutureCast wiring

1. Beat Desk **Open** hydrates On3 + builds brief.
2. `feedDeskIntelToFutureCast` may seed/promote/refresh 2028 targets (never expands 2027 Closing Class).
3. Desk shows a **FutureCast feed** card (seeded / promoted / refreshed + %).
4. `#futurecast/control` lists admin allowlist extras, board sample, early watch — add/remove 2028 only.

## Film / highlights in Copy Brief

Curated Hudl / On3 highlight traits live in `server/data/recruiting/film-traits.json` (keyed by player slug).

1. Beat Desk **Open** / **Copy Brief** resolves film traits for the slug and embeds a **FILM / HIGHLIGHTS** section in the paste packet.
2. Desk shows a **Film / highlights** card when traits exist.
3. Upsert via Admin Hub API (PIN required):
   - `GET /api/admin/hub/film-traits` — list
   - `GET /api/admin/hub/film-traits/:slug` — one player
   - `POST /api/admin/hub/film-traits` — body `{ slug, playerName, sources[], traits[], vaultFilmAngle, doNotClaim[], clipNotes }`
4. Goal: paste brief → Cursor already has tape facts. Use them in the post; never announce that you’re “different” or ahead of the beat.
5. **Rival rule:** rivals are calm mid-post board context only — never dunk, never the punchline/closer. Close on Florida process.

## Player projection / comp in Copy Brief

Recruit briefs embed a **PLAYER PROJECTION / COMP** block from War Room breakdowns (`comparison`, `projection`, optional `schemeFit` / `nflProjection` in `server/data/war-room/breakdowns.json`). Beat Desk shows the same card on **Open**.

### Charles standard (do not re-litigate per player)

**Projection** = contribution path + ceiling, sold clean — and **position-true**:
- **When:** packages as a freshman / Year 2–3 / multi-year project
- **Role:** must fit the position — QB is develop → compete for the job → starter upside (**never** “rotational QB”); EDGE/WR/DL/OL may use depth · rotation · every-down when true
- **Ceiling:** starter / every-down / All-SEC upside as appropriate (sell the upside — never write “not All-American” or other downplay lines)

**GatorVault player comp** = size filter first, then traits:
- **Body size is non-negotiable:** height within ~1–2" of the recruit; same frame/build family
- Then similar **win traits** from tape (not size-only, not traits-only at the wrong height)
- Not a higher elite band than the projection (if the comp is an All-American household name, the projection has to match)
- Do **not** default to Florida alumni — only if that is clearly the best size + tape fit
- Example fail: 6-5 / 190 QB ≠ 6-1 pocket QB, even if both are “upright progressive”

1. Film desk / Open **reads** War Room `projection` + `comparison` when available.
2. **Copy Brief** always prints both — War Room values when present, or “none on file — AGENT MUST DRAFT” instructions when empty.
3. Cursor post must always include: **HEADER** (intel leap) + deeper film eval (2–3 tape specifics) + short projection clause + one calm size-matched GatorVault comp mid-post. Never close on the comp.
4. **Persist (required):** after drafting a new eval/comp/projection, write it into War Room + film-traits with `node server/scripts/upsert-vault-film-eval.js` (JSON under `server/data/war-room/vault-evals/`). Do not leave comps only in the X draft.
5. Commit cards / profiles pull Comp + Projection live from War Room (`getVaultScoutingForSlug`) — no app rebuild.
6. Confirm with Charles before treating a brand-new eval/comp as live FutureCast card copy (Charles asking to embed = confirmation).

### On3 / Hudl highlight LINK in Copy Brief

For **every** Beat Desk recruit:

1. **Open** → auto-pull On3/Hudl highlight URL(s) into the brief (free — no OpenAI).
2. Desk shows **LINK READY** when a highlight URL is on file.
3. **Copy Brief** includes `FILM / HIGHLIGHTS` with the LINK plus an agent instruction: review the tape, then draft.
4. Charles pastes into Cursor → agent opens the highlight link, evaluates, writes the post (board + tape).
5. Bulk link pull: `POST /api/admin/hub/film-traits/hydrate-desk` or `node server/scripts/hydrate-film-traits-from-on3.js --desk`
6. No paid OpenAI vision required for this workflow.


## Shell polish

- Typography: Source Sans 3 + Oswald (not Inter)
- Blue/orange atmospheric gradients on the shell background
- Letter nav marks (BD / CC / FC…) instead of emoji icons
- Sticky **ops strip** under the top bar
- Legacy nav grouped under a divider

## Module health dots

Sidebar dots are **honest**, but desks are scoped so Charles is not blocked by unrelated kitchen noise:

| Module | Dot source |
|---|---|
| **Beat Desk** | API posting health only (wake-lag / 0% 5xx → green) |
| **FutureCast** | Recruiting board freshness |
| **Dashboard** | Full ops overall (Film Room, drafts, API, etc.) |
| **Content** | Film Room + Insider articles |

| Color | Meaning |
|---|---|
| Green | Probe says healthy |
| Yellow | Warning / backlog |
| Red | Failure |
| Gray | Unknown — no probe yet |

Modules without a live signal stay gray (never fake-green).

## Aggregated APIs

| Endpoint | Role |
|---|---|
| `GET /api/admin/hub/overview` | Command Center payload |
| `GET /api/admin/hub/module-health` | Sidebar dots + alert count |
| `GET /api/admin/hub/search` | Global search |
| `GET /api/admin/members/recent` | Newest members |
| `GET /api/admin/hub/futurecast` | Targets + allowlist summary |
| `POST /api/admin/hub/allowlist/add` | Add 2028 admin allowlist slug |
| `POST /api/admin/hub/allowlist/remove` | Remove 2028 admin allowlist slug |

All require a valid admin PIN header. Member responses never include `passwordHash`.

## Local verify

```bash
node --test server/tests/admin-hub-routes.test.js
node --test server/test/admin-hub-elite-ia.test.js
node --test server/test/admin-hub-futurecast.test.js
node --test server/test/on3-rpm-scale.test.js
```

After Netlify deploy: open `/admin/hub`, confirm Beat Desk default, FutureCast panel, refresh-on-revisit, and that iframe URLs do not contain `pin=`.
