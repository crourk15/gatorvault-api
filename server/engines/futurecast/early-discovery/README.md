# Early Discovery Engine

Identifies and scores underclassmen (2027+).

**Spec:** `server/docs/futurecast-platform-spec.md` §2.1

| File | Role |
|------|------|
| `index.ts` | Public entry — `runEarlyDiscovery()` |
| `pipeline.ts` | Roster ingest → signals → score → UF relevance |
| `signals.ts` | Signal creation + dedupe + score_impact rules |

**Job name:** `engine:early-discovery`
