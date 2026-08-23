# Submit 1.0.19 (Build 84+) — new train after 1.0.18 approved

**Why:** App Store Connect closed the **1.0.18** pre-release train (`90186` / `90062`). New uploads must use a higher `CFBundleShortVersionString`.

## iOS

- `MARKETING_VERSION = 1.0.19`
- `CURRENT_PROJECT_VERSION = 84` (Codemagic may auto-bump above ASC latest)

## App Store Connect (you)

1. **Apps → GatorVault → + Version → 1.0.19** (if ASC does not auto-create it)
2. Merge this version bump to `main`
3. Re-run Codemagic **iOS Release Build** on `main`
4. Attach the processed build to **1.0.19** / TestFlight

## Ships in this bake

Client/UI backlog from `docs/IOS_CODEMAGIC_BACKLOG.md`, including:

- Community: post→open thread, Staff open vs Member threads, Recent default, category tabs
- Why we chase: truth-first voice + thin-room gate (trench/CB ≥85 only; no WR "thin room" from weight table)
- Where Florida needs help: depth-honest need board
- Game Week: 2026 uniforms + Helmet/Jersey/Pants color chips on the matchup hero
- Prior chase / Closest / Articles / visit plates still waiting from the closed 1.0.18 train

API/data fixes remain live on Render without this bake.

## Whats New (paste)

```
Community is easier to find and post in. Why we chase and Where Florida needs help are more honest. Game Week shows this week's Helmet / Jersey / Pants colors. Plus chase-board and visit-intel polish from the last bake queue.
```
