# Submit 1.0.27 (Build 92+) — closed

**Closed:** 1.0.27 shipped Matchup Edge only. **1.0.28 is also closed** (accepted Sep 21, 2026). Next train is **1.0.29** (`docs/APP_STORE_1_0_29.md`). Do not start another 1.0.27 or 1.0.28 IPA.

**Why:** App Store Connect closed the **1.0.26** pre-release train. Codemagic publish failed:

- `iris-code` **90062** — `CFBundleShortVersionString` [1.0.26] is not higher than the previously approved version [1.0.26]
- `iris-code` **90186** — train version `1.0.26` is closed for new build submissions

New uploads must use a higher marketing version.

## iOS

- `MARKETING_VERSION = 1.0.27`
- `CURRENT_PROJECT_VERSION = 92` (Codemagic may auto-bump above ASC latest)

## App Store Connect (you)

1. **Apps → GatorVault → + Version → 1.0.27** (if ASC does not auto-create it)
2. Merge this version bump to `main`
3. Re-run Codemagic **iOS Release Build** on `main`
4. Attach the processed build to **1.0.27** / TestFlight

Do **not** start Codemagic until this bump is on `main` and **1.0.27** exists in App Store Connect.

## Ships in this bake

- Game Week Matchup Edge reads the sat `radar` stamp (Ole Miss LSU sit — not the 51% formula hexagon)
- Game Week skips a posted final immediately (home leaves Auburn for Ole Miss)
- Gators Live faster poll + Florida-only betting fallback
- Everything that was queued for 1.0.26 (Rivalry Week badge, Film Room seed, …) — that train cannot take another IPA

Weekly schedule TV / predictions stay API. Do not bake those.

## Whats New (paste)

```
Game Week Matchup Edge is the Ole Miss sit. Live scores stay on Florida. Rivalry Week badge is FSU and Georgia only.
```
