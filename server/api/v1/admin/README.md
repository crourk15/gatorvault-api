# Admin API — engine triggers

**Spec:** `server/docs/futurecast-platform-spec.md` §3.5

Auth: `X-Ops-Pin` / `X-Recruiting-Pin` (existing GatorVault pattern).

| Endpoint | Engine |
|----------|--------|
| `POST .../early-discovery/run` | Early Discovery |
| `POST .../portal-intelligence/run` | Portal Intelligence |
| `POST .../uf-fit/recompute` | UF Fit Score |
