# Submit 1.0.24 (Build 89+) — Review off Film Room

**Why:** App Store Connect closed the **1.0.23** pre-release train (`iris-code` 90186). New uploads must use a higher `CFBundleShortVersionString`.

## iOS

- `MARKETING_VERSION = 1.0.24`
- `CURRENT_PROJECT_VERSION = 89` (Codemagic may auto-bump above ASC latest)

## App Store Connect (you)

1. **Apps → GatorVault → + Version → 1.0.24** (if ASC does not auto-create it)
2. Merge this version bump to `main`
3. Re-run Codemagic **iOS Release Build** on `main`
4. Attach the processed build to **1.0.24** / TestFlight

## Ships in this bake

- Film Room: Review tab off. Lands on Breakdowns. GNFP Week 1 FAU tape.

## Whats New (paste)

```
Film Room lands on Breakdowns. GNFP Week 1 FAU tape. GatorVault Review is off the rail.
```
