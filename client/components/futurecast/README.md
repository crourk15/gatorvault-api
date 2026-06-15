# FutureCast Elite — Component & Metric Guide

This folder contains all UI components for the FutureCast Elite experience, including:

- Master Board
- Trending Board
- Movement Intel
- Staff Notes
- Player Cards
- Heatmap
- Confidence Meter
- Commit Watch
- High Priority Targets

---

## Core Metrics

FutureCast Elite uses four primary metrics across all player cards and analytics surfaces:

### **UF % — Likelihood**

FutureCast model commit probability for Florida.  
Represents the statistical likelihood UF lands the player.

### **Staff % — Insider Confidence**

Internal staff sentiment based on notes, evaluations, and recruiting feel.

### **Fit % — Scheme Match**

Scheme + roster + athletic fit score.  
Represents how well the player fits Florida’s system.

### **Priority Score — Importance**

Weighted importance metric for UF’s 2027 class strategy.  
Represents how big of a priority the player is.  
Not a probability.

**Canonical references**

- UI labels & formatters: `client/lib/futurecast-elite-metrics.ts`
- API response types: `server/types/futurecast-elite-api.ts` (client mirror: `client/lib/futurecast-elite-api-types.ts`)
- Metric legend component: `MetricLegend.tsx`

---

## Component Standards

- All components should use the `gv-*` and `fc-*` tokenized class system.
- All metrics must be displayed consistently across cards and layouts.
- Priority Score determines ordering in High Priority Targets and Commit Watch.
- UF %, Staff %, and Fit % must remain separate and never merged.

---

## API Integration

All FutureCast Elite components consume data from:

- `/api/futurecast/master-board`
- `/api/futurecast/trending`
- `/api/futurecast/movement-intel`
- `/api/futurecast/staff-notes`
- `/api/futurecast/high-priority`
- `/api/futurecast/home`
- `/api/futurecast/heatmap`

All responses include the four core metrics defined above (field names may vary: e.g. `ufConfidence` on board payloads = UF %).

---

## Notes

- Do not confuse Priority Score with commit probability.
- Do not derive Fit Score from UF % or Staff % — it is independent.
- All metrics must be typed using the shared FutureCast API types.

---

## Component map

| Component | Purpose |
|-----------|---------|
| `FutureCastElitePageShell.tsx` | Shared page shell + CSS import |
| `FutureCastHero.tsx` | Elite hero (gradient, parallax) |
| `MetricLegend.tsx` | Explains the four core metrics |
| `TrendingPlayerCard.tsx` | Trending board player row |
| `CommitWatch.tsx` | Top 3 commit pulse cards |
| `ConfidenceMeter.tsx` | Board-average UF % gauge |
| `HighPriorityList.tsx` | Master board priority list |
| `StaffNoteCard.tsx` | Staff notes card |
| `HighPriorityTargetCard.tsx` | Full four-metric recruit card |
| `PlayerCard.tsx` | Big Board row (ClassicRecruitCard; legacy hub) |

**Platform spec:** `server/docs/futurecast-platform-spec.md` §4
