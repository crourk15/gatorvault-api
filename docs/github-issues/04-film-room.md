# [P0] Film Room: scheme hub (formations, personnel, defensive evolution)

**Labels:** P0, film-room, content, brand-critical

Full spec: [docs/PLATFORM-DIRECTIVE.md](../PLATFORM-DIRECTIVE.md#4-film-room--functional-scheme-hub-film-room-nerd-persona)

## Requirement

Build a functional Film Room hub that supports weekly scheme breakdowns (formations, personnel packages, defensive evolution). Content organized by **game / week / opponent**. Match the **"Film Room Nerd"** persona — no surface-level ESPN-style takes.

## Acceptance criteria

- [ ] Content model: season, week, opponent, tags (formation, personnel, coverage), tier
- [ ] Weekly breakdown template: pre-snap look, formation ID, personnel grouping, what worked/failed and **why**
- [ ] Browse/filter by week and opponent; latest week on hub landing
- [ ] Film Room articles tied into sourced article pipeline
- [ ] No placeholder empty hub in production

## Current baseline

Film Room tab exists; mostly static articles + highlights loader — no week/opponent content model.

## Verification

Hub lists content by week/opponent; breakdown includes formation/personnel detail beyond surface recap.
