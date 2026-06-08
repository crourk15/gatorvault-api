# [P0] Portal Headliner: On3 measurables audit & alignment

**Labels:** P0, portal, on3, brand-critical

Full spec: [docs/PLATFORM-DIRECTIVE.md](../PLATFORM-DIRECTIVE.md#1-portal-headliner--on3-source-of-truth)

## Requirement

Portal measurables (height/weight, stars, previous school) must be pulled from the correct On3 endpoint consistently. **No manual overrides** — everything source-driven and accurate.

## Canonical On3 source

- URL: `https://www.on3.com/college/florida-gators/football/{classYear}/commits/`
- Row filter: commits with `transferRating` (portal transfers)
- Fields: `player.height`, `player.weight`, `transferRating.stars`, previous school from `organization`

## Acceptance criteria

- [ ] Headliner + portal list + player profiles read from same API (no hardcoded `portalIncoming` fallback)
- [ ] `node server/scripts/audit-portal-measurables.js` passes with zero mismatches vs On3
- [ ] Scheduled sync on ingest keeps data current
- [ ] UI shows On3 source badge and profile links

## Current baseline

On3 sync code exists (`on3-client.js`, `syncPortalFromOn3`); UI still has static fallback in `index.html` until API loads.

## Verification

```bash
cd server && node scripts/sync-on3-portal.js && node scripts/audit-portal-measurables.js
```

Compare Eric Singleton Jr. ht/wt/stars against On3 commits board.
