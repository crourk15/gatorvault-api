# Submit 1.0.26 (Build 91+) — closed 1.0.25 train + Rivalry Week badge

**Why:** App Store Connect closed the **1.0.25** pre-release train. Codemagic publish failed:

- `iris-code` **90062** — `CFBundleShortVersionString` [1.0.25] is not higher than the previously approved version [1.0.25]
- `iris-code` **90186** — train version `1.0.25` is closed for new build submissions

New uploads must use a higher marketing version. Charles already parked the Home **RIVALRY WEEK** badge on this train.

## iOS

- `MARKETING_VERSION = 1.0.26`
- `CURRENT_PROJECT_VERSION = 91` (Codemagic may auto-bump above ASC latest)

## App Store Connect (you)

1. **Apps → GatorVault → + Version → 1.0.26** (if ASC does not auto-create it)
2. Merge this version bump to `main`
3. Re-run Codemagic **iOS Release Build** on `main`
4. Attach the processed build to **1.0.26** / TestFlight

Do **not** start Codemagic until this bump is on `main`.

## Ships in this bake

- Home countdown **RIVALRY WEEK** = FSU + UGA only. Auburn is Game Week.
- Everything that was queued for 1.0.25 (Stats tab official box, Film Room Breakdowns, Game Week next kickoff, Game Zone strip, …) — that train cannot take another IPA.

Weekly schedule predictions / Game Week intel stay API. Do not bake those.

## Whats New (paste)

```
Rivalry Week badge is FSU and Georgia only. Team profiles show official-box stats. Film Room lands on Breakdowns. Game Week opens the next kickoff.
```
