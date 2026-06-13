# GatorVault v1.0 — Master Product Specification

| Field | Value |
|-------|-------|
| **Status** | Authoritative |
| **Owner** | Charles Rourk |
| **Version** | 1.0 |
| **Scope** | Full platform architecture, UI, routing, API, data model, and module integration |
| **Site** | [gatorvaultinsider.com](https://gatorvaultinsider.com) |
| **API** | `gatorvault-api.onrender.com` (proxied via Netlify `/api/*`) |

When implementation and this document conflict, **implementation must be updated to match this spec** unless the owner explicitly revises this document.

---

## Table of contents

1. [Global navigation structure](#1-global-navigation-structure)
2. [Vault navigation structure](#2-vault-navigation-structure)
3. [FutureCast internal navigation](#3-futurecast-internal-navigation)
4. [Routing rules (critical)](#4-routing-rules-critical)
5. [API contract — lifecycle filters](#5-api-contract--lifecycle-filters)
6. [Recruiting Board v1.0](#6-recruiting-board-v10)
7. [FutureCast → Vault integration](#7-futurecast--vault-integration)
8. [Homepage FutureCast feature block](#8-homepage-futurecast-feature-block)
9. [UI component library](#9-ui-component-library)
10. [Data model spec](#10-data-model-spec)
11. [Error handling framework](#11-error-handling-framework)
12. [Deployment rules](#12-deployment-rules)
13. [Product Health system](#13-product-health-system)
14. [Final summary](#14-final-summary)
15. [Appendix: implementation map](#appendix-implementation-map)

---

## 1. Global navigation structure

### 1.1 Top-level site navigation (public)

Visible on `/` and all public pages.

| Label | Route | Notes |
|-------|-------|-------|
| Home | `/` | Marketing landing + vault entry |
| Inside the Vault | `/vault` | Opens vault (gate → interior) |
| FutureCast | `/futurecast` | Public FutureCast module |
| Film Room | `/film-room` | Optional public entry; vault version at `/vault/film-room` |
| Login / Join | `/join` | Registration / vault gate (`openRegModal` / join flow) |

**React public shell:** `client/components/site/GatorVaultSiteNav.tsx`  
**Landing nav:** `server/index.html` → `#nav-main`

---

## 2. Vault navigation structure

### 2.1 Vault sidebar navigation (private)

Visible on all `/vault/*` routes.

| Label | Route | Module |
|-------|-------|--------|
| Dashboard | `/vault` | Vault home / start |
| Depth Chart | `/vault/depth-chart` | Team depth chart |
| Recruiting | `/vault/recruiting` | Live recruiting tab |
| **FutureCast** | `/vault/futurecast` | **Embedded FutureCast module** |
| Portal | `/vault/portal` | Portal radar |
| Players Directory | `/vault/players` | Player directory (all lifecycles) |
| Scouting Hub | `/vault/scouting` | Scouting department |
| Film Room | `/vault/film-room` | Highlights / film hubs |
| Game Week | `/vault/game-week` | Game week hub |
| Live Feed | `/vault/live-feed` | Live dashboard |
| Staff / Admin | `/vault/staff` | Permission-gated (operator PIN / staff mode) |

**Recruiting Board** (tier board) lives at `/vault/recruiting-board` — linked from Recruiting cross-links; see [§6](#6-recruiting-board-v10).

**Sidebar source of truth:** `client/lib/vault-routes.ts` → `VAULT_SIDEBAR`  
**React shell:** `client/components/vault/VaultShell.tsx`  
**Monolith sidebar:** `#gv-vault-sidebar` in `server/index.html`

### 2.2 Monolith tab mapping

Vault overlay tabs in `server/index.html` map to sidebar routes:

| Sidebar route | Monolith `data-vtab` |
|---------------|----------------------|
| `/vault` | `start` |
| `/vault/depth-chart` | `team` |
| `/vault/recruiting` | `recruit` |
| `/vault/portal` | `portal` |
| `/vault/film-room` | `highlights` |
| `/vault/game-week` | `gameweek` |
| `/vault/live-feed` | `live` |
| `/vault/staff` | `analytics` (PIN-gated) |

FutureCast, Players Directory, Scouting Hub, and Recruiting Board are **React routes** under `/vault/*`, not monolith panes.

---

## 3. FutureCast internal navigation

Inside **`/futurecast`** (public) or **`/vault/futurecast`** (vault-embedded). Sub-nav paths are **prefix-aware** — same relative paths under each base.

| Label | Standalone | Vault-embedded |
|-------|------------|----------------|
| Home | `/futurecast` | `/vault/futurecast` |
| Stock Up / Down | `/futurecast/stock` | `/vault/futurecast/stock` |
| Snapshots | `/futurecast/snapshots` | `/vault/futurecast/snapshots` |
| Alerts | `/futurecast/alerts` | `/vault/futurecast/alerts` |
| Staff | `/futurecast/staff` | `/vault/futurecast/staff` (protected) |
| Player Profile | `/futurecast/player/:slug` | `/vault/futurecast/player/:slug` |

**Component:** `client/components/site/FutureCastSubNav.tsx`  
**Legacy aliases (must keep working):** `/player/:slug` → HS profile · `/alerts` → alerts feed · `/staff/dashboard` → staff dashboard

---

## 4. Routing rules (critical)

### 4.1 HS player profile routing

| Context | Route |
|---------|-------|
| Public | `/futurecast/player/:slug` |
| Vault | `/vault/futurecast/player/:slug` |

**Alias:** `/player/:slug` redirects to HS profile (Netlify 301 from `/futurecast/player/*`).

### 4.2 Portal player profile routing

| Context | Route |
|---------|-------|
| Public | `/portal/:slug` |
| Vault | `/vault/portal/:slug` |

### 4.3 Roster player profile routing

| Context | Route |
|---------|-------|
| Public | `/players/:slug` |
| Vault | `/vault/players/:slug` |

### 4.4 Rules

| Rule | Enforcement |
|------|-------------|
| HS players **never** route to portal or roster pages | `playerProfilePath()` in `client/lib/player-routes.ts` |
| Portal players **never** route to FutureCast | Lifecycle check on profile load |
| Roster players **never** route to FutureCast | Lifecycle check on profile load |
| Lifecycle mismatch | Friendly error + button linking to correct lifecycle route |

**Mismatch UI copy:**

> This player doesn't have a profile in this section.

**Component:** `client/components/site/UiMessage.tsx` → `UiError`

---

## 5. API contract — lifecycle filters

### 5.1 Player lifecycle field

Every player in every API response **must** include:

```
lifecycle: "HIGH_SCHOOL" | "PORTAL" | "ROSTER"
```

- No nulls.
- No mixing lifecycles within a single endpoint response.

**Normalization:** `server/shared/lifecycle.ts`  
**DB mapping:** `HIGH_SCHOOL` ↔ Postgres `HS` · `PORTAL` ↔ Postgres `PORTAL` · `ROSTER` ↔ roster JSON store

### 5.2 FutureCast (HS-only) endpoints

| Endpoint | Method | Filters |
|----------|--------|---------|
| `/api/futurecast/targets` | GET | `lifecycle === "HIGH_SCHOOL"`, `isTarget === true` |
| `/api/futurecast/commits` | GET | `lifecycle === "HIGH_SCHOOL"`, `isCommittedToUF === true` |
| `/api/futurecast/big-board` | GET | `lifecycle === "HIGH_SCHOOL"`, `classYear === 2027` (or requested) |
| `/api/futurecast/movement` | GET | `lifecycle === "HIGH_SCHOOL"` |
| `/api/futurecast/home` | GET | HS predictions + movement; portal watchlist in separate subsection |
| `/api/futurecast/stock` | GET | HS stock up/down |
| `/api/futurecast/snapshots` | GET | HS daily/weekly snapshots |
| `/api/futurecast/heatmap` | GET | Alias of movement buckets |

**Mount:** `server/api/futurecast/mount.ts`  
**Default class year:** 2027

**Empty response (HTTP 200):**

```json
{
  "lifecycle": "HIGH_SCHOOL",
  "count": 0,
  "empty": true,
  "message": "No players found for this category yet."
}
```

### 5.3 Portal endpoints

| Endpoint | Method | Filters |
|----------|--------|---------|
| `/api/portal/watchlist` | GET | `lifecycle === "PORTAL"`, `ufInterest === true` |
| `/api/portal/players` | GET | `lifecycle === "PORTAL"` |
| `/api/portal/predictions/:id` | GET | Player must be `PORTAL` |

**ufInterest:** `uf_status` present and not `NONE`, OR `uf_fit_score > 0`.

### 5.4 Roster endpoints

| Endpoint | Method | Filters |
|----------|--------|---------|
| `/api/roster/players` | GET | `lifecycle === "ROSTER"` |
| `/api/roster/players/:slug` | GET | Single roster player |

### 5.5 Shared rules

| Rule | Detail |
|------|--------|
| No mixed lifecycles | SQL/store filter at query time — never filter only in UI |
| Multi-lifecycle needs | Create a new explicit endpoint (e.g. `/api/all-players`) — do not reuse FutureCast routes |
| Empty results | Friendly UI message — never raw JSON errors on React surfaces |
| Anti-pattern | Returning the same ~31 players on every endpoint (missing lifecycle WHERE clause) |

---

## 6. Recruiting Board v1.0

### 6.1 Route

| Route | Shell |
|-------|-------|
| `/vault/recruiting-board` | Vault (authoritative) |
| `/recruiting-board` | Public direct route |

**Must NOT** redirect to `/admin` or prompt for admin PIN on public routes.  
**Admin embed only:** `/recruiting-board?embed=1` (iframe inside admin hub).

### 6.2 Tiers

| Tier ID | Label |
|---------|-------|
| `TOP` | Top Priorities |
| `HIGH` | High Interest |
| `MEDIUM` | Medium Interest |
| `LOW` | Low Interest |
| `EVAL` | Evaluation Needed |

### 6.3 Player card fields

Each card displays:

- Name
- Position
- Class year
- State
- UF Probability
- Fit Score
- Staff Grade
- Status
- Notes preview (public)
- **Full Profile** link → HS profile (`/futurecast/player/:slug` or vault equivalent)

### 6.4 Data source

**Endpoint:** `GET /api/recruiting/board?class=2027`

**Canonical player shape:**

```json
{
  "tier": "TOP",
  "name": "Keith Neal Jr.",
  "position": "WR",
  "classYear": 2027,
  "state": "FL",
  "ufProbability": 0.72,
  "fitScore": 0.91,
  "staffGrade": "A",
  "status": "Offered",
  "notes": "Staff note text",
  "slug": "keith-neal-jr",
  "lifecycle": "HIGH_SCHOOL"
}
```

**Response wrapper:**

```json
{
  "ok": true,
  "classYear": 2027,
  "lifecycle": "HIGH_SCHOOL",
  "players": [ /* array above */ ],
  "tiers": [ /* grouped sections with count badges */ ]
}
```

**Store:** `server/lib/recruiting-store.js` (On3 ingest) · **Enrichment:** `server/lib/recruiting-board-enrich.js`

### 6.5 Filters

- Position
- State
- Class year
- Tier

### 6.6 Sorting

- UF Probability (desc)
- Fit Score (desc)
- Staff Grade

### 6.7 Permissions

| Mode | Notes | Edit |
|------|-------|------|
| Public | No staff notes (preview only, max ~120 chars) | No |
| Staff (`?mode=staff`) | Full notes + internal flags | Yes (admin tools) |

**UI:** `client/components/site/RecruitingBoardPage.tsx`

---

## 7. FutureCast → Vault integration

### 7.1 Embedded route

**`/vault/futurecast`** loads:

1. Vault shell (sidebar + top nav)
2. FutureCast app in the content area

Same engine as `/futurecast`; different chrome.

### 7.2 Sidebar link

**FutureCast** appears in Vault sidebar nav → `/vault/futurecast`.  
Clicking keeps the user inside Vault — no new tab, no bounce to homepage.

### 7.3 Cross-module links

| From | Link target |
|------|-------------|
| Recruiting | `/vault/futurecast` |
| Portal | `/vault/futurecast` (portal watchlist section) |
| Roster | `/vault/futurecast` (future: impact view) |

All in-vault links use **`/vault/futurecast`**, not bare `/futurecast`.

### 7.4 Profile routing

| Lifecycle | Profile destination |
|-----------|---------------------|
| HS | FutureCast (`/vault/futurecast/player/:slug`) |
| Portal | Portal (`/vault/portal/:slug`) |
| Roster | Players (`/vault/players/:slug`) |

### 7.5 Error handling

On lifecycle mismatch:

1. Show: *"This player doesn't have a profile in this section."*
2. Button: *Open player in the correct section* → correct lifecycle route from [§4](#4-routing-rules-critical)

---

## 8. Homepage FutureCast feature block

### 8.1 Placement

Below hero section, above Film Room.  
**DOM:** `#futurecast-sec` in `server/index.html`

### 8.2 Components

| Element | Content |
|---------|---------|
| Header | **FutureCast — Florida Recruiting Intelligence** |
| Description | Live recruiting predictions, movement, portal intel |
| Live preview | Heatmap **or** top 3 targets + latest commit + portal snippet |
| CTA | **Open FutureCast** |

**Preview APIs:** `/api/futurecast/home`, `/api/futurecast/targets`, `/api/futurecast/commits`

### 8.3 Behavior

| User state | CTA destination |
|------------|-----------------|
| Logged in (`gv_session.email`) | `/vault/futurecast` |
| Not logged in | `/futurecast` |

**Function:** `gvOpenFutureCast()` in `server/index.html`

---

## 9. UI component library

### 9.1 Card components

| Component | Use | File |
|-----------|-----|------|
| `PlayerCard` | Generic player tile | `components/futurecast/PlayerCard.tsx` |
| `PortalCard` | Portal watchlist | `components/futurecast/PortalWatchlistCard.tsx` |
| `RosterCard` | Roster directory | Player directory cards |
| `RecruitingBoardCard` | Tier board | `RecruitingBoardPage` board cards |
| `FutureCastCard` | Prediction feed | `components/futurecast/FutureCastHomeCard.tsx` |

### 9.2 Section panels

| Element | Spec |
|---------|------|
| Header | `.gv-page-section__title` — Oswald, bold |
| Divider | Border `gator-blue/20` |
| Count badge | `.gv-page-section__badge` — orange pill |
| Grid layout | `.gv-board-grid` / `.fc-home-card-grid` — 1→2→3 columns |

### 9.3 Metrics row

| Metric | Display |
|--------|---------|
| UF Probability | Percent, orange |
| Fit Score | 0–100 or 0.00–1.00 |
| Movement arrows | Green up / red down |
| Stability | Volatility inverse |

**Components:** `TrendingIndicator`, `VolatilityMeter`, `ConfidenceBar`, `FitScoreBadge`

### 9.4 Photo fallback

- Initials from player name
- Colored background (position- or tier-based)
- Rounded circle / rounded-xl

---

## 10. Data model spec

### 10.1 Player object (canonical)

```typescript
{
  slug: string;
  name: string;
  position: string;
  classYear: number;
  state: string;
  lifecycle: "HIGH_SCHOOL" | "PORTAL" | "ROSTER";
  ufProbability?: number | null;
  fitScore?: number | null;
  movementDelta?: number | null;
  stability?: number | null;
  portalPercent?: number | null;   // portal only
  depthRisk?: number | null;       // portal only
  notes?: string | null;
  status?: string | null;
}
```

### 10.2 Store map

| Lifecycle | Primary store |
|-----------|---------------|
| `HIGH_SCHOOL` | Postgres `futurecast.*` |
| `PORTAL` | Postgres `futurecast.*` + portal profiles |
| `ROSTER` | JSON `server/lib/roster-store.js` |
| Recruiting Board | JSON `server/lib/recruiting-store.js` |

**Enums:** `server/shared/enums.ts`  
**Engine detail:** `server/docs/futurecast-platform-spec.md`

---

## 11. Error handling framework

### 11.1 API errors

Friendly UI messages — never expose stack traces or raw JSON on user-facing pages.

| Condition | Copy |
|-----------|------|
| Empty results | "No players found for this category yet." |
| Service down | "This section is temporarily unavailable." |
| Generic failure | "Try again later." + retry button |

**Component:** `UiError`, `UiEmpty` — `client/components/site/UiMessage.tsx`  
**Client:** `client/lib/api-fetch.ts`

### 11.2 Routing errors

| Case | Behavior |
|------|----------|
| Slug not found | 404 UI + link to directory |
| Wrong lifecycle section | Mismatch message + link to correct route ([§4.4](#44-rules)) |

### 11.3 Rate limits

When API returns 429 or Render cold-start timeout:

> Service temporarily busy — retrying

Auto-retry with backoff on feed pages (60s refresh interval on alerts/staff).

---

## 12. Deployment rules

### 12.1 Netlify (frontend)

**Publish directory:** `server/` (after `npm run build:netlify`)

Includes:

- Homepage (`index.html`)
- Vault shell / monolith
- FutureCast UI (`/futurecast/*`, `/vault/futurecast/*`)
- Recruiting Board UI
- Scouting Hub UI
- Players / Portal profiles
- `_redirects` + `netlify.toml`

**Build:** `client/` Next.js export → `client/scripts/merge-into-server.js`

### 12.2 Render (backend)

Includes:

- Express API (`server/server.js`)
- Data ingestion (On3, Rivals, portal sync)
- Player classification / lifecycle assignment
- FutureCast engine
- Portal engine
- Product Health + QA scheduler

**Deploy:** `render.yaml` → push to `main` auto-deploys

### 12.3 Redirect rules (critical)

| From | To | Why |
|------|-----|-----|
| `/recruiting-board` | `recruiting-board/index.html` | React board — **not** admin HTML |
| `/portal/:slug` | `portal/index.html` | Portal profile SPA |
| `/futurecast/player/:slug` | HS profile page | Canonical HS route |
| `/player/:slug` | HS profile page | Legacy alias |
| `/api/*` | Render API proxy | Same-origin |
| `/vault/futurecast/*` | Vault FutureCast React export | Embedded module |

**Never on Render public host:** Serve `recruiting-board.html` (admin) for `/recruiting-board` without React export — redirect to `SITE_URL` instead.

### 12.4 Cache rules

| Resource | Cache TTL |
|----------|-----------|
| General API responses | 60–120 seconds (CDN/proxy optional) |
| FutureCast movement / heatmap | 5 minutes |
| `/_next/static/*` | Long-cache (content-hashed) |
| `index.html` | No cache / short TTL |

---

## 13. Product Health system

### 13.1 Recompute job

- Runs every **10 minutes** (configurable via `PRODUCT_INTEL_RECOMPUTE_INTERVAL_MS`; default 300000ms — **target: 600000ms per v1.0**)
- Recomputes when QA run is newer than last snapshot

**File:** `server/lib/product-intel/product-intel-scheduler.js`

### 13.2 Snapshot writer

Writes health scores and layer breakdown to product intel store (`server/lib/product-intel/product-intel-store.js`; JSON under `server/data/`).

### 13.3 QA crawler

Validates:

- Routing (all critical paths resolve)
- API (lifecycle endpoints return correct types)
- UI (pages render without console errors)
- Error states (friendly fallbacks present)
- Mobile behavior

**Files:** `server/lib/qa/qa-runner.js`, `server/lib/qa/qa-store.js`

### 13.4 Admin panel

**Route:** `/admin/product-health` → `admin-product-intel.html`

Displays:

- Overall health score
- Failed checks / fix queue
- Last run timestamp
- Error feed (last 50 — cleared on passing crawl)

**Manual action:** "QA + Recompute" button after each deploy.

---

## 14. Final summary

This v1.0 spec defines the complete blueprint for GatorVault:

| Domain | Covered |
|--------|---------|
| Navigation | Global, Vault sidebar, FutureCast sub-nav |
| Routing | HS / Portal / Roster profile rules |
| API | Lifecycle-separated endpoints |
| Data model | Canonical player object + stores |
| UI | Component library, cards, metrics |
| FutureCast integration | Embedded + standalone |
| Recruiting Board | Tiers, filters, permissions |
| Portal | Watchlist + profiles |
| Roster | Directory + profiles |
| Homepage | FutureCast feature block |
| Error handling | API, routing, rate limits |
| Deployment | Netlify + Render split |
| Product Health | QA → recompute → admin |

**This document is the authoritative source of truth for the entire platform.**

---

## Appendix: implementation map

Quick reference from spec → code (for engineers).

| Spec section | Primary files |
|--------------|---------------|
| §1 Global nav | `server/index.html`, `GatorVaultSiteNav.tsx` |
| §2 Vault nav | `vault-routes.ts`, `VaultShell.tsx`, `index.html` `#gv-vault-sidebar` |
| §3 FC sub-nav | `FutureCastSubNav.tsx` |
| §4 Profile routes | `player-routes.ts`, `_redirects`, `netlify.toml` |
| §5 API lifecycle | `server/shared/lifecycle.ts`, `server/api/futurecast/*`, `server/api/portal/*`, `server/lib/roster-routes.js` |
| §6 Recruiting Board | `RecruitingBoardPage.tsx`, `recruiting-board-enrich.js`, `recruiting-routes.js` |
| §7 FC ↔ Vault | `client/app/vault/futurecast/**`, `client/app/layout.tsx` |
| §8 Homepage block | `server/index.html` `#futurecast-sec`, `gvOpenFutureCast()` |
| §11 Errors | `UiMessage.tsx`, `api-fetch.ts` |
| §12 Deploy | `merge-into-server.js`, `REQUIRED_EXPORTS`, `_redirects` |
| §13 Product Health | `product-intel-scheduler.js`, `product-intel-engine.js`, `admin-product-intel.html` |

### v1.0 implementation checklist

| Item | Spec § | Status |
|------|--------|--------|
| Global nav (Home, Vault, FutureCast) | §1 | Done |
| Vault sidebar all items | §2 | Done |
| `/vault/futurecast` VaultShell | §7 | Done |
| Lifecycle API separation | §5 | Done |
| Recruiting Board tiers | §6 | Done |
| Homepage FC block + login CTA | §8 | Done |
| `/futurecast/player/:slug` canonical route | §3, §4 | Redirect alias exists; vault path TBD |
| `/vault/portal/:slug`, `/vault/players/:slug` | §4 | TBD |
| Lifecycle mismatch error UI | §4, §11 | TBD |
| `/film-room`, `/join` public routes | §1 | TBD (optional / join modal) |
| Product Health 10-min interval | §13 | Set `PRODUCT_INTEL_RECOMPUTE_INTERVAL_MS=600000` on Render |
| API cache headers 60–120s | §12 | TBD |

### Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-06-05 | Charles Rourk | v1.0 authoritative spec published |
