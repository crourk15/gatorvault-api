# [P0] Articles: scheduled pipeline + strict sourcing rules

**Labels:** P0, articles, content, brand-critical

Full spec: [docs/PLATFORM-DIRECTIVE.md](../PLATFORM-DIRECTIVE.md#2-articles--scheduled-pipeline-with-strict-sourcing)

## Requirement

Implement a scheduled article pipeline with strict sourcing rules. Every article must have a source tag (On3, official team site, approved outlets). **No unsourced content goes live.**

## Approved sources

On3, FloridaGators.com, 247Sports, Rivals Florida, OnlyGators, Gators Online, named beat writers (`TRUSTED_REPORTERS` in `content-validator.js`).

## Acceptance criteria

- [ ] Draft → validate → publish with server-side source enforcement
- [ ] Published articles show visible source tags + links in UI
- [ ] Scheduled publish cadence (e.g. Wednesday article) via cron
- [ ] Static inline articles in `index.html` removed or routed through pipeline

## Current baseline

Validator + content queue exist (`content-validator.js`, `content-store.js`, `content-routes.js`); no scheduled publish cron.

## Verification

```bash
cd server && node scripts/validate-published-content.js
```

Attempt publish without sources via admin API → expect rejection.
