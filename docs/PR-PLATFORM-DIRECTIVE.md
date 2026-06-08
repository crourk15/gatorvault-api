# PR: Add platform alignment directive (P0 foundation)

**Branch:** `feature/platform-directive` → `main`  
**Create PR:** https://github.com/crourk15/gatorvault-api/compare/main...feature/platform-directive?expand=1

---

## Summary

- Adds `docs/PLATFORM-DIRECTIVE.md` — brand-critical P0 spec for Portal Headliner, Articles pipeline, Depth Chart, and Film Room
- Adds GitHub issue templates (`.github/ISSUE_TEMPLATE/`) and copy-ready issue bodies (`docs/github-issues/`)
- Adds `scripts/create-platform-issues.ps1` for bulk issue creation via GitHub CLI
- Links directive from `server/README.md`

## Why merge first

This directive is the P0 foundation. Implementation PRs should follow **after** merge, in order:

1. Portal Headliner (On3 measurables)
2. Articles (scheduled pipeline + sourcing)
3. Depth Chart (event-driven + admin + version history)
4. Film Room (scheme hub)

## Test plan

- [ ] Review acceptance criteria in `docs/PLATFORM-DIRECTIVE.md` for all four pillars
- [ ] Confirm issue templates appear at **Issues → New issue** after merge
- [ ] Baseline audit table matches current codebase state

## Files changed

12 files, +527 lines — docs and issue templates only; no runtime behavior changes.
