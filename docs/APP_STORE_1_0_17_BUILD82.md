# Submit 1.0.17 (Build 82+) — Expected visitors + chase visit UI

**Why:** New marketing train after 1.0.16. Bakes Game Week Expected visitors panel + Chase Expected visit plate (and other Codemagic backlog UI).

## iOS

- `MARKETING_VERSION = 1.0.17`
- `CURRENT_PROJECT_VERSION = 82` (Codemagic may auto-bump above ASC latest)

## App Store Connect (you)

1. **Apps → GatorVault → + Version → 1.0.17** (if ASC does not auto-create it)
2. Merge PR #473 (visitors panel) + this version bump to `main`
3. Run Codemagic **iOS Release Build** on `main`
4. Attach the processed build to **1.0.17** / TestFlight

## Ships in this bake

- Game Week dedicated Expected visitors panel (API lists stay editable after)
- Chase card Expected visit plate
- Prior backlog UI rows waiting for next Codemagic
