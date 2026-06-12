# UF Fit Score System

Computes 0–100 UF Fit Score from weighted sub-scores.

**Spec:** `server/docs/futurecast-platform-spec.md` §2.3

| File | Role |
|------|------|
| `index.ts` | `runUfFitRecompute()` |
| `compute-fit.ts` | Sub-score gather + composite formula |
| `weights.ts` | Weight constants (25/20/15/10/10/10/10) |

**Job name:** `engine:uf-fit-recompute`

Fan-facing name: **UF Fit Score™** — spec §5
