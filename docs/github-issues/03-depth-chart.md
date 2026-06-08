# [P0] Depth Chart: event-driven system + admin + version history

**Labels:** P0, depth-chart, admin, brand-critical

Full spec: [docs/PLATFORM-DIRECTIVE.md](../PLATFORM-DIRECTIVE.md#3-depth-chart--event-driven-with-admin--version-history)

## Requirement

Build an event-driven depth chart system with an admin tool for manual updates when news breaks. Track version history and show **"Last updated"** timestamps. Depth chart must reflect real news, not static placeholders.

## Acceptance criteria

- [ ] Backend depth chart store with offense / defense / special teams, 1–3 deep per position
- [ ] Status per slot: Locked / Battle / Watch / Transfer
- [ ] PIN-protected admin UI for position edits and notes
- [ ] Version history on every save with prior snapshot view
- [ ] Public UI reads API + displays "Last updated" timestamp
- [ ] Hardcoded depth chart arrays removed from `index.html`

## Suggested API

```
GET  /api/depth-chart
GET  /api/depth-chart/history
POST /api/depth-chart          (admin, PIN)
GET  /admin/depth-chart.html
```

## Current baseline

Frontend-only static data in `index.html`; no backend store, admin tool, or version history.

## Verification

Admin edit → version saved → public UI shows new "Last updated" timestamp.
