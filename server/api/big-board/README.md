# FutureCast Big Board API (Phase 4)

**GET `/api/big-board`** — ranked players with intelligence scores.

## Query params

| Param | Description |
|-------|-------------|
| `class_year` | Filter by class |
| `position` | Filter by position |
| `lifecycle` | HS \| COLLEGE \| PORTAL |
| `sort` | rank, signals, portalLikelihood, ufFit, name, position |
| `order` | asc \| desc (default desc) |
| `limit` | 1–500 (default 200) |

## Scoring

```
total = signalScore * 0.40 + portalLikelihood * 100 * 0.30 + (ufFit/100) * 100 * 0.30
```

Engine: `engine.ts` · Repository: `models/big-board.ts`
