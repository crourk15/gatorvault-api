# On3 Industry profile ranks — 2026-08-14

## Bugs fixed
1. **Stale `2028-target-board.json` clobber** — `applyEditorialPositionToPlayer` always overwrote live store ranks (Wright stuck at #208 while On3 Industry was #1). Board seed now **fills gaps only**.
2. **Industry field picker** — profile mapping uses consensus-only ranks (`consensusOverallRank` = Industry national on On3). Never fall back to single-service `overallRank` / `positionRank`.
3. **FutureCast HP seed order** — recruiting store ranks/rating win over board seed.
4. **Durable boot merge** — fresher bundled `players.json` Industry ranks merge into `/var/data` on boot (durable never full-overwrites).

## Sync
- Script: `server/scripts/sync-on3-industry-profile-ranks.js`
- Coverage: **548 / 617** On3-linked 2026–2029 profiles now carry Industry natl ranks
- Remaining misses are mostly early **2029** names with no Industry consensus yet
- **Brysen Wright:** #1 natl · #1 WR · #1 FL · 98.03

## Verify
```bash
node -e "const p=require('./server/data/recruiting/players.json').find(x=>x.slug==='brysen-wright'); console.log(p.natlRank,p.posRank,p.stateRank,p.rating)"
```
