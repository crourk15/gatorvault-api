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

## Shell polish

- Typography: Source Sans 3 + Oswald (not Inter)
- Blue/orange atmospheric gradients on the shell background
- Letter nav marks (BD / CC / FC…) instead of emoji icons
- Sticky **ops strip** under the top bar
- Legacy nav grouped under a divider

## Module health dots

Sidebar dots are **honest**:

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
