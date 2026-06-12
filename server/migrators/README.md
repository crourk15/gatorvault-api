# FutureCast Player Migrator (Phase 2)

Loads `server/data/players.json` into the FutureCast Postgres schema via repository functions.

## Run

```bash
# 1. Transform legacy recruiting data → FutureCast players.json
npm run transform:players

# 2. Load into Postgres (requires DATABASE_URL)
npm run migrate:players
```

## Input format

See GitHub issue **FutureCast: players.json → Postgres Migrator (Phase 2)** for full spec.

```json
[
  {
    "full_name": "Example Player",
    "slug": "example-player",
    "class_year": 2028,
    "position": "QB",
    "status": "HS",
    "high_school_profile": { "offers": [], "stats": {} },
    "signals": [{ "signal_type": "OFFER", "signal_value": { "school": "Florida" } }]
  }
]
```

## Behavior

- Validates enums via `server/shared/enums.ts`
- Repository layer only (no raw SQL)
- Idempotent player/profile upserts via slug / `player_id`
- Skips duplicate discovery signals on re-run
- Continues on per-player errors; prints summary report

## Legacy source

To build `players.json` from recruiting store, transform `data/recruiting/players.json` into FutureCast shape (separate script / manual ETL).
