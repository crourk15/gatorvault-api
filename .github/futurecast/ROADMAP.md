# FutureCast GitHub Roadmap

**Source of truth:** [`server/docs/futurecast-platform-spec.md`](../../server/docs/futurecast-platform-spec.md)

## Create issues

```bash
node scripts/create-futurecast-github-issues.js --dry-run
node scripts/create-futurecast-github-issues.js
```

Creates **52 issues** with labels:

| Label | Phase |
|-------|-------|
| `phase-0-scaffolding` | Directories, placeholders, spec refs |
| `phase-1-data-model` | Postgres, repositories, enums |
| `phase-2-engines` | Discovery, portal intel, UF fit, cron |
| `phase-3-api` | REST endpoints + mount |
| `phase-4-frontend` | React Big Board + Profiles 2.0 |

Each issue links to the spec, lists file paths, and includes acceptance criteria.

## Project board (manual)

1. GitHub → Projects → New board → **FutureCast**
2. Add columns: Backlog · Phase 0 · Phase 1 · Phase 2 · Phase 3 · Phase 4 · Done
3. Filter by label `futurecast`
