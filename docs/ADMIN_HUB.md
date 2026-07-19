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

1. Operator enters PIN on `/admin/login`.
2. PIN is stored in `sessionStorage` (`gv_admin_pin` / `gv_ops_pin`).
3. Hub API calls send `X-Ops-Pin` / `X-Recruiting-Pin` headers (not query strings).
4. Iframe embeds receive PIN via same-origin `sessionStorage` + `postMessage` to `location.origin` — **PIN is not appended to iframe URLs**.

Accepted pins come from env vars (`OPS_ADMIN_PIN`, `ADMIN_PASSWORD`, `RECRUITING_ADMIN_PIN`, …).  
Set `OPS_ADMIN_PIN` in Render for production. A legacy default exists only as a last-resort fallback when no env pins are configured — do not rely on it long term.

## In-shell panels (no iframe)

- **Command Center** — `#dashboard/overview`
- **Runbooks** — `#dashboard/runbooks` (also `#gm2/rerun`)
- **Vault Grades Manager** — `#recruiting/vault-grades` / `#team/vault-grades`
- **Settings** — `#settings/platform`

## Runbooks

Presets with step status (session log):

- Deploy recovery
- QA is red
- Ingest lag
- Content rebuild
- Live feed quiet

## Module health dots

Sidebar dots are **honest**:

| Color | Meaning |
|---|---|
| Green | Probe says healthy |
| Yellow | Warning / backlog |
| Red | Failure |
| Gray | Unknown — no probe yet |

Modules without a live signal stay gray (never fake-green).

## Global search

`GET /api/admin/hub/search?q=` returns players / articles / users with:

- `route` — hub hash navigation (click)
- `href` — public vault URL (Cmd/Ctrl-click)

## Aggregated APIs

| Endpoint | Role |
|---|---|
| `GET /api/admin/hub/overview` | Command Center payload |
| `GET /api/admin/hub/module-health` | Sidebar dots + alert count |
| `GET /api/admin/hub/search` | Global search |

All require a valid admin PIN header.

## Local verify

```bash
node --test server/tests/admin-hub-routes.test.js
```

After Netlify deploy: open `/admin/hub`, confirm Runbooks, search navigation, and that iframe URLs do not contain `pin=`.
