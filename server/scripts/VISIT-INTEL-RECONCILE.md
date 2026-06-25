# Visit Intel Reconcile (A6)

Clears **stale official-visit fields** on recruiting store rows (Supabase or local JSON) so FutureCast boards never show past OVs as upcoming.

## What it does

1. Loads verified visit logs (`recruiting-visit-log-store`)
2. For each player, if there is **no upcoming verified UF OV** but the store still has `visitStart`, `visitEnd`, or `ufOvStatus=scheduled|visit`, patches the row to completed/cleared
3. When rows change (`expired > 0`), busts in-memory FutureCast API cache

## Endpoints

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/futurecast/visit-intel/reconcile` | `x-monitoring-cron: $MONITORING_CRON_SECRET` |
| POST | `?dryRun=true` | same (no writes) |

Also available as ops job: `POST /api/ops/run-job` with `{ "jobId": "visit-intel-reconcile" }`.

## Cron (Render)

- Service: `gatorvault-api-visit-intel-reconcile`
- Schedule: every 3 hours (`15 */3 * * *`)
- Script: `server/scripts/render-visit-intel-reconcile-cron.js`
- Env: `VISIT_INTEL_RECONCILE_URL`, `MONITORING_CRON_SECRET`

Hub refresh (`gatorvault-api-hub-refresh`, every 6h) also runs reconcile before cache warm.

Platform ops cron includes `visit-intel-reconcile` in its job list.

## Manual run

```bash
cd server
npm run visit-intel:reconcile -- --dry-run    # local, no writes
npm run visit-intel:reconcile               # local apply
npm run visit-intel:reconcile -- --remote --dry-run   # production smoke
```

## Guardian smoke

`node scripts/verify-visit-intel-api.js` checks reconcile export.

`node scripts/platform-guardian-predeploy.js` runs visit-intel smoke before deploy.

## Supabase notes

- Uses `recruiting-store.upsertPlayer()` — works in `storageMode() === 'supabase'`
- Visit **logs** remain append-only; reconcile only fixes denormalized player fields
- After On3/beat ingest adds visit logs, run reconcile (automatic via ingest hub refresh or 3h cron)
- **On3 ingest:** after `syncOn3VisitOfferIntel` when visit logs, offers, or player visit fields change, runs `reconcileVisitIntelInStore()` inline (Phase C)