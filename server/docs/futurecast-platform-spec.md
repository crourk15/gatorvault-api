# FutureCast Platform — Developer Specification

**Handoff doc for backend, frontend, and data engineers.**  
**Stack:** REST API · Postgres (recommended) · modern SPA (React/Vue) · optional GraphQL phase 2.

---

## 0. Goal

Build a **UF-centric football intelligence platform** with five integrated systems:

| System | Scope |
|--------|--------|
| **Early Discovery Engine** | High school, class of 2027+ and beyond (emphasis 2028–2030) |
| **Portal Intelligence Layer** | College + transfer portal movement prediction |
| **Player Profiles 2.0** | Unified player graph (HS → college → portal → UF) |
| **FutureCast Big Board** | UF recruiting + portal hub (ranked views) |
| **UF Fit Score System** | Proprietary 0–100 UF fit metric |

**Backend:** API-driven (REST primary; GraphQL optional later).  
**Frontend:** Modern SPA, component-based.  
**Database:** Relational (**Postgres** recommended; Supabase already wired in GatorVault). Graph DB optional only if relationship queries become dominant.

### Existing GatorVault integration

| Today | FutureCast |
|-------|------------|
| `data/recruiting/players.json` | → `Player` + profiles |
| `rivals-prediction-ingest.js` | → `recruiting_momentum_score` + signals |
| `data/war-room/breakdowns.json` | → `UFSpecificProfile.war_room_notes` |
| GM2 / War Room | Portal filters + scouting context for engines |
| `/api/recruiting/*` | Shim → new player/futurecast routes |

---

## 1. Core data model

**Conventions:** UUID v4 primary keys · UTC timestamps · height in inches · weight in lbs · JSON fields as JSONB in Postgres.

### 1.1 `Player`

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `slug` | string | Unique URL key (keep compat with current API, e.g. `keith-neal-jr`) |
| `name` | string | |
| `preferred_name` | string \| null | |
| `positions` | string[] | e.g. `["WR","ATH"]` |
| `primary_position` | string | Board sort key |
| `height` | number | Inches |
| `weight` | number | Lbs |
| `dob` | date \| null | |
| `hometown_city` | string | |
| `hometown_state` | string | |
| `country` | string | Default `US` |
| `photo_url` | string \| null | |
| `class_year` | number | e.g. 2027 |
| `created_at` | datetime | |
| `updated_at` | datetime | |

### 1.2 `HighSchoolProfile`

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `player_id` | UUID | FK → Player |
| `school_name` | string | |
| `school_city` | string | |
| `school_state` | string | |
| `jersey_number` | string \| null | |
| `varsity_years` | number[] | |
| `stats_json` | JSON | Season/game stats |
| `film_links` | string[] | Hudl, YouTube |
| `awards` | string[] | |
| `camp_history` | JSON | `{ name, date, notes }[]` |
| `combine_results` | JSON | `{ forty, shuttle, vert, ... }` |
| `offer_list_public` | string[] | Public offer school names |
| `discovery_score` | number | 0–100, computed by Early Discovery Engine |

> **Note:** `discovery_score` may alternatively live on `UFSpecificProfile` if you prefer a single scores table; default placement is `HighSchoolProfile`.

### 1.3 `CollegeProfile`

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `player_id` | UUID | FK → Player |
| `school_name` | string | |
| `conference` | string | |
| `jersey_number` | string \| null | |
| `years_at_school` | number[] | |
| `stats_json` | JSON | |
| `snap_counts_json` | JSON \| null | |
| `depth_chart_history` | JSON | `{ date, position, team_level }[]` |
| `scheme_notes` | string \| null | |

### 1.4 `PortalProfile`

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `player_id` | UUID | FK → Player, unique |
| `portal_status` | enum | `none` \| `watchlist` \| `in_portal` \| `committed` |
| `entry_date` | date \| null | |
| `exit_date` | date \| null | |
| `destination_school` | string \| null | |
| `reason_tags` | string[] | e.g. `buried_depth_chart`, `scheme_mismatch`, `coach_change` |
| `portal_likelihood_score` | number | 0–100 |
| `uf_interest_level` | enum | `none` \| `light` \| `moderate` \| `strong` |

### 1.5 `UFSpecificProfile`

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `player_id` | UUID | FK → Player, unique |
| `uf_fit_score` | number | 0–100 composite |
| `scheme_fit_score` | number | 0–100 |
| `positional_need_score` | number | 0–100 |
| `athletic_profile_score` | number | 0–100 |
| `geographic_ties_score` | number | 0–100 |
| `timeline_fit_score` | number | 0–100 |
| `culture_fit_score` | number | 0–100 |
| `recruiting_momentum_score` | number | 0–100 |
| `uf_status` | enum | `none` \| `watchlist` \| `target` \| `commit` \| `former_target` |
| `war_room_notes` | text | Staff scouting report |
| `uf_commit_probability` | number \| null | 0–100, optional — powers **Predictions** tab |
| `score_computed_at` | datetime | Last engine run |

### 1.6 `DiscoverySignal`

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `player_id` | UUID | FK → Player |
| `signal_type` | enum | See below |
| `source` | string | URL or label |
| `value` | JSON | Event-specific payload |
| `score_impact` | number | Points toward discovery aggregate |
| `created_at` | datetime | |

**`signal_type` values**

`varsity_as_freshman` · `camp_mvp` · `combine_result` · `7v7_performance` · `coach_quote` · `local_media` · `social_buzz`

> Rivals FutureCast / RPM picks feed `recruiting_momentum_score`; optionally also insert a `local_media` or custom extended type in phase 2.

### 1.7 Relationships

```
Player 1──0..1 HighSchoolProfile
Player 1──0..1 CollegeProfile
Player 1──0..1 PortalProfile
Player 1──0..1 UFSpecificProfile
Player 1──* DiscoverySignal
```

---

## 2. Engines (backend logic)

All engines: **idempotent**, **logged** (GV-OM / ops-monitor), **re-runnable** via cron or admin trigger.

### 2.1 Early Discovery Engine

**Purpose:** Identify and score underclassmen (2027+).

**Inputs**

- Public rosters (HS, JV, freshman, 7v7, camps, combines)
- Public stats (MaxPreps, Hudl metadata)
- Public media / social signals

**Flow**

1. **Roster ingestion** — Parse rosters → upsert `Player` + `HighSchoolProfile`.
2. **Signal creation** — For each notable event (freshman varsity, camp MVP, etc.) → insert `DiscoverySignal` (dedupe by player + type + source hash).
3. **Discovery score** — Aggregate `score_impact` per player (time decay optional) → store `discovery_score` on `HighSchoolProfile`.
4. **UF relevance** — Apply rules (Florida ties, position need, traits) → set `UFSpecificProfile.uf_status` to `watchlist` or `target`.

**Job:** `engine:early-discovery` · daily + on-demand.

---

### 2.2 Portal Intelligence Layer

**Purpose:** Predict portal movement + UF relevance.

**Inputs**

- College stats, depth charts, coaching changes
- Public portal trackers
- Public social / media signals

**Flow**

1. **Usage vs talent** — Compare efficiency vs snaps → flag underused players.
2. **Depth chart squeeze** — Track depth chart changes → add `reason_tags` (e.g. `buried_depth_chart`).
3. **Context signals** — Coaching / scheme changes → tags `scheme_mismatch`, `coach_change`.
4. **Portal likelihood** — Combine tags → `PortalProfile.portal_likelihood_score` (0–100).
5. **UF fit** — Run UF Fit Score System → update `UFSpecificProfile`.

**Job:** `engine:portal-intelligence` · every 6h in portal windows; daily otherwise.

---

### 2.3 UF Fit Score System

**Purpose:** Compute 0–100 UF fit score.

| Sub-score | Weight |
|-----------|--------|
| `scheme_fit_score` | 25% |
| `positional_need_score` | 20% |
| `athletic_profile_score` | 15% |
| `geographic_ties_score` | 10% |
| `timeline_fit_score` | 10% |
| `culture_fit_score` | 10% |
| `recruiting_momentum_score` | 10% |

**Formula**

```
UF_FIT_SCORE =
  scheme_fit_score       * 0.25 +
  positional_need_score  * 0.20 +
  athletic_profile_score * 0.15 +
  geographic_ties_score  * 0.10 +
  timeline_fit_score     * 0.10 +
  culture_fit_score      * 0.10 +
  recruiting_momentum_score * 0.10
```

Store result in `UFSpecificProfile.uf_fit_score` (round to integer). Persist all sub-scores for War Room breakdown UI.

**Job:** `engine:uf-fit-recompute` · on profile/signal change + nightly sweep.

---

## 3. Key API endpoints (REST)

Base path in GatorVault: **`/api`** (prefix as needed). JSON in/out. Pagination: `?page=&limit=`.

### 3.1 Player Profiles 2.0

#### `GET /api/players/:id`

`:id` = UUID or `slug`.

**Returns:** `Player` + `HighSchoolProfile` + `CollegeProfile` + `PortalProfile` + `UFSpecificProfile` + `DiscoverySignal[]` (recent).

```json
{
  "ok": true,
  "player": { },
  "high_school": { },
  "college": { },
  "portal": { },
  "uf": { },
  "signals": [ ]
}
```

#### `GET /api/players`

| Query | Description |
|-------|-------------|
| `class_year` | Filter by class |
| `uf_status` | `watchlist`, `target`, `commit`, … |
| `primary_position` | Position filter |
| `min_uf_fit_score` | |
| `min_discovery_score` | |
| `sort` | `uf_fit_score`, `discovery_score`, `name` |

---

### 3.2 FutureCast Big Board

#### `GET /api/futurecast/big-board`

| Query | Description |
|-------|-------------|
| `class_year` | **Required** |
| `tab` | `top_targets` \| `early_discovery` \| `portal_watchlist` \| `predictions` \| `movement_tracker` |

**Returns:** Ranked list; each row includes:

- `uf_fit_score`
- `portal_likelihood_score`
- `discovery_score` (when HS)
- `uf_status`
- `reason_tags`
- `uf_commit_probability` (Predictions tab)

| Tab | Sort / filter |
|-----|----------------|
| **Top Targets** | `uf_status` ∈ target, commit · sort `uf_fit_score` desc |
| **Early Discovery** | `class_year` ≥ 2028 · sort `discovery_score` desc |
| **Portal Watchlist** | portal active/watch · sort `portal_likelihood_score` desc |
| **Predictions** | Has `uf_commit_probability` · sort probability desc |
| **Movement Tracker** | Status or score delta in last 14 days |

---

### 3.3 Portal Watchlist

#### `GET /api/portal/watchlist`

| Query | Description |
|-------|-------------|
| `min_portal_likelihood` | Default 50 |
| `min_uf_fit_score` | Default 60 |
| `primary_position` | |
| `portal_status` | |

---

### 3.4 Early Discovery

#### `GET /api/futurecast/early-discovery`

| Query | Description |
|-------|-------------|
| `class_year_gte` | Default 2028 |
| `min_discovery_score` | |
| `min_uf_fit_score` | Optional |

---

### 3.5 Admin (staff)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/admin/engines/early-discovery/run` | On-demand discovery |
| `POST` | `/api/admin/engines/portal-intelligence/run` | Portal recompute |
| `POST` | `/api/admin/engines/uf-fit/recompute` | `{ player_id? }` |
| `PATCH` | `/api/players/:id/uf` | Override sub-scores / `war_room_notes` |

Auth: existing `X-Ops-Pin` / `X-Recruiting-Pin`.

---

## 4. Frontend features

### 4.1 FutureCast Big Board

**Route:** `/futurecast`

| Tab | Content |
|-----|---------|
| **Top Targets** | Sorted by UF Fit Score |
| **Early Discovery** | 2028–2030, sorted by discovery score |
| **Portal Watchlist** | Portal Intelligence Layer UI |
| **Predictions** | Players with UF commit probability |
| **Movement Tracker** | Recent changes in scores / status |

**Player card (each row)**

- Name, position, class year, photo
- **UF Fit Score** badge (color bands: 90+, 75–89, 60–74, &lt;60)
- Portal likelihood (college players)
- UF status chip: watchlist / target / commit
- Tap → Player Profile 2.0

---

### 4.2 Player Profiles 2.0

**Route:** `/players/:slug`

| Section | Content |
|---------|---------|
| **Header** | Name, photo, position, class year, UF Fit Score, UF status |
| **High school** | School, stats, film, awards, camps, combines, discovery score |
| **College** | School, stats, snaps, depth chart history, scheme notes |
| **Portal** | `portal_status`, likelihood, reason tags, destination school |
| **UF War Room** | `war_room_notes`, fit breakdown (scheme, need, timeline, culture) |

---

### 4.3 Portal Watchlist

**Route:** `/portal/watchlist`

Table / grid:

| Column | Field |
|--------|--------|
| Player | name, photo |
| School | current school |
| Position | `primary_position` |
| Portal likelihood | `portal_likelihood_score` |
| UF Fit | `uf_fit_score` |
| Tags | `reason_tags` |
| Status | `portal_status` |

---

## 5. Naming (fan-facing)

Use these names in UI, marketing, and API field labels where user-visible:

| Internal | Fan-facing name |
|----------|-----------------|
| Big board hub | **FutureCast Big Board** — UF recruiting + portal hub |
| Unified profile | **Player Profiles 2.0** — unified player journey mapped to UF |
| Portal UI | **Portal Watchlist** — Portal Intelligence Layer |
| Underclassmen feed | **FutureCast Early Discovery** — 2027+ and beyond |
| Composite metric | **UF Fit Score™** — 0–100 UF-specific fit metric |

---

## Appendix A — Suggested module layout

```
server/lib/futurecast/
  models/                 # DB access layer
  engines/
    early-discovery.js
    portal-intelligence.js
    uf-fit-score.js
  routes/
    players-routes.js
    futurecast-routes.js
    portal-routes.js
  ingest/
    maxpreps-roster.js
    portal-tracker.js
data/futurecast/
  config.json             # weights, priority positions, thresholds
```

---

## Appendix B — Implementation phases

| Phase | Deliverable |
|-------|-------------|
| **0** | Postgres schema + migrator from `players.json` + read `GET /api/players/:slug` |
| **1** | UF Fit engine + Big Board API + Top Targets / Early Discovery tabs |
| **2** | Early Discovery engine + HS ingest + discovery endpoints |
| **3** | Portal Intelligence + Watchlist + Movement Tracker |
| **4** | Predictions (`uf_commit_probability`) + mobile polish + alerts |

---

## Appendix C — Non-functional requirements

| Requirement | Target |
|-------------|--------|
| Big board p95 (cached) | &lt; 400ms |
| Engine failures | GV-OM alert; no silent partial publish |
| Score audit | Store `score_computed_at` + engine version |
| Compliance | Public/licensed sources only at ingest |

---

*Spec v1.1 · GatorVault / FutureCast · Aligns with GM2, War Room, Self-Runner 3.0 guardian stack.*
