# Submit 1.0.23 (Build 88+) — Gators Live living room train

**Why:** This bake is **1.0.23**, not 1.0.22. Create that version in App Store Connect before attaching the build.

## iOS

- `MARKETING_VERSION = 1.0.23`
- `CURRENT_PROJECT_VERSION = 88` (Codemagic may auto-bump above ASC latest)

## App Store Connect (you)

1. **Apps → GatorVault → + Version → 1.0.23** (if ASC does not auto-create it)
2. Merge this version bump to `main`
3. Run Codemagic **iOS Release Build** on `main`
4. Attach the processed build to **1.0.23** / TestFlight

## Ships in this bake

Client/UI backlog, including:

- Game Week + Home countdown: auto-open the next kickoff (Campbell this week; Auburn after that — no FAU hardcode)
- Gators Live living room (stadium hero, talk, 3 keys, visitors, film bite)
- Gators Live poll: 10s live / 15s idle + ticking countdown
- Community Game day chip + hero copy
- Member page trail ping + `X-GV-Client`
- Game Week Prediction: Vegas from `/api/betting/lines`
- Auth client retries + friendly wake-up copy
- Community Edit + Delete on own posts
- Home NOW freshness / remaining UI backlog from the 1.0.21–1.0.22 queue

API/data fixes remain live on Render without this bake.

## Whats New (paste)

```
Game Week now opens the next kickoff with a live countdown. Gators Live is now the Swamp living room: live score and clock, game-day talk, 3 keys, and visitors. Faster live refresh. Community Game day thread. Sharper Game Week Vegas lines. Edit/Delete your Community posts. Home NOW freshness and other UI backlog.
```
