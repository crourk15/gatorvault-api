# GatorVault — Brand-Critical Platform Alignment Directive

**Priority:** P0 — these four areas must match what we promise on the site and in sales/onboarding.

**Goal:** Audit current implementation, close gaps, and ship production-ready systems. No placeholder content in user-facing surfaces.

**Repo:** [crourk15/gatorvault-api](https://github.com/crourk15/gatorvault-api)

---

## Cross-cutting rules

1. **Source-driven data** — recruiting, portal, and articles trace to a named external source or admin audit trail.
2. **No silent fallbacks** — if API/sync fails, show stale timestamp + error state; do not show hardcoded wrong data.
3. **Production alignment** — marketing copy promises (Monday depth chart, Wednesday article, weekly Film Room, On3 portal) must match live behavior.
4. **Deliverables per pillar:** audit report (current vs required) → implementation PR → production verification checklist.

---

## Current baseline (audit snapshot)

| Pillar | Status today | Key files |
|--------|--------------|-----------|
| **Portal Headliner** | On3 sync code exists; UI still has static `portalIncoming` fallback in `index.html` until API loads | `server/lib/on3-client.js`, `server/lib/on3-ingest.js`, `server/scripts/sync-on3-portal.js`, `server/scripts/audit-portal-measurables.js` |
| **Articles** | Validator + content queue exist; no scheduled publish cron | `server/lib/content-validator.js`, `server/lib/content-store.js`, `server/lib/content-routes.js` |
| **Depth Chart** | Frontend-only static data in `index.html`; no backend store, admin tool, or version history | `server/index.html` (inline depth chart arrays) |
| **Film Room** | Tab exists; mostly static articles + highlights loader — no week/opponent content model | `server/index.html`, `server/data/content/articles.json` |

---

## 1. Portal Headliner — On3 source of truth

**Requirement:** Portal measurables (height/weight, stars, previous school) must be pulled from the correct On3 endpoint consistently. **No manual overrides** — everything is source-driven and accurate.

### Canonical On3 source

- **URL:** `https://www.on3.com/college/florida-gators/football/{classYear}/commits/`
- **Row filter:** commits with `transferRating` (portal transfers), not HS recruit `rating`
- **Fields:** `player.height`, `player.weight`, `transferRating.stars`, previous school from `organization`

### Acceptance criteria

- [ ] Headliner + portal list + player profiles all read from the same synced dataset/API — not hardcoded fallbacks in `index.html`
- [ ] Every portal player shows On3-sourced ht/wt, stars, and previous school
- [ ] `node server/scripts/audit-portal-measurables.js` passes with zero mismatches vs On3
- [ ] Scheduled sync on ingest (or cron) keeps data current without manual edits
- [ ] UI displays source badge (“On3”) and links to On3 profile
- [ ] Remove or gate static `portalIncoming` array — API is sole source after load

### Verification

```bash
cd server
node scripts/sync-on3-portal.js
node scripts/audit-portal-measurables.js
curl https://gatorvault-api.onrender.com/api/recruiting/portal
```

Compare Eric Singleton Jr. (and sample set) ht/wt/stars against the On3 commits board.

---

## 2. Articles — Scheduled pipeline with strict sourcing

**Requirement:** Implement a scheduled article pipeline with strict sourcing rules. Every article must carry a source tag (On3, official team site, approved outlets). **No unsourced content goes live.**

### Approved source taxonomy

- On3
- FloridaGators.com / official team site
- Named approved outlets: 247Sports, Rivals Florida, OnlyGators, Gators Online, beat writers (see `TRUSTED_REPORTERS` in `content-validator.js`)

### Acceptance criteria

- [ ] Draft → validate → publish workflow with server-side enforcement (reject articles missing `sources[]`)
- [ ] Each published article shows visible source tag(s) + link(s) in article UI (`article.html`)
- [ ] Scheduled publish cadence (e.g. Wednesday article per marketing promise) via cron/scheduler
- [ ] Validator blocks AI-invented / unsourced / paywalled reproduction before publish
- [ ] No static inline articles in `index.html` bypassing the pipeline
- [ ] `GET /api/content/policy` reflects live enforcement state

### Verification

```bash
cd server
node scripts/validate-published-content.js
# Attempt publish without sources via admin API → expect 400
curl https://gatorvault-api.onrender.com/api/content/published
```

---

## 3. Depth Chart — Event-driven with admin + version history

**Requirement:** Build an event-driven depth chart system with an admin tool for manual updates when news breaks. Track version history and show **“Last updated”** timestamps. Depth chart must reflect real news, not static placeholders.

### Acceptance criteria

- [ ] Backend depth chart store (JSON or DB) with offense / defense / special teams, 1–3 deep per position
- [ ] Status per slot: Locked / Battle / Watch / Transfer
- [ ] PIN-protected admin UI to edit positions, depth order, status, and notes
- [ ] Version history: every save creates a revision; view prior snapshot + who/when updated
- [ ] Public UI reads from API only; displays **“Last updated: [timestamp]”**
- [ ] Event hooks: portal commit, roster change, or manual admin edit triggers refresh
- [ ] Remove hardcoded depth chart arrays from `index.html`

### Suggested API surface

```
GET  /api/depth-chart
GET  /api/depth-chart/history
POST /api/depth-chart          (admin, PIN)
GET  /admin/depth-chart.html   (admin UI)
```

### Verification

Admin edit → version saved → public UI shows new “Last updated” timestamp.

---

## 4. Film Room — Functional scheme hub (Film Room Nerd persona)

**Requirement:** Build a functional Film Room hub for weekly scheme breakdowns — formations, personnel packages, defensive evolution. Content organized by **game / week / opponent**. Match the **“Film Room Nerd”** persona: depth over ESPN-style surface takes.

### Acceptance criteria

- [ ] Dedicated Film Room hub (not just embedded highlight clips)
- [ ] Content model: `season`, `week`, `opponent`, tags (formation, personnel, coverage), tier (Film / War)
- [ ] Weekly breakdown template: pre-snap look, formation ID, personnel grouping, what worked/failed and **why**
- [ ] Browse/filter by week and opponent; latest week surfaced on hub landing
- [ ] Film Room articles tied into sourced article pipeline (pillar 2)
- [ ] No placeholder “Loading…” or empty hub in production

### Suggested content schema

```json
{
  "id": "film-2026-w01-charleston",
  "season": 2026,
  "week": 1,
  "opponent": "Charleston Southern",
  "title": "Week 1: 3-3-5 vs Spread Option",
  "tags": ["formation", "personnel", "coverage"],
  "sections": [
    { "type": "formation", "title": "Base 3-3-5 look", "body": "..." },
    { "type": "personnel", "title": "Nickel package", "body": "..." }
  ],
  "sources": [{ "outlet": "On3", "url": "..." }],
  "tier": "film",
  "publishedAt": "2026-08-25T12:00:00Z"
}
```

### Verification

Hub lists content by week/opponent; breakdown includes formation/personnel detail beyond surface-level recap.

---

## Post-ship verification checklist

| Area | Test | Pass |
|------|------|------|
| Portal | Eric Singleton Jr. ht/wt/stars match On3 commits board | ☐ |
| Portal | No static fallback overrides API data after load | ☐ |
| Articles | Publish without sources → blocked | ☐ |
| Articles | Published article shows source tag + link | ☐ |
| Articles | Wednesday scheduled publish fires (season) | ☐ |
| Depth Chart | Admin edit → version saved → “Last updated” visible | ☐ |
| Depth Chart | Public UI reads API, not inline JS arrays | ☐ |
| Film Room | Hub lists content by week/opponent | ☐ |
| Film Room | Breakdown includes formation/personnel detail | ☐ |

---

## GitHub tracking

Create issues from templates in [`.github/ISSUE_TEMPLATE/`](../.github/ISSUE_TEMPLATE/) or run:

```powershell
# Requires GitHub CLI: winget install GitHub.cli
.\scripts\create-platform-issues.ps1
```

**These four areas are brand-critical. Audit, implement, and align with our offering.**
