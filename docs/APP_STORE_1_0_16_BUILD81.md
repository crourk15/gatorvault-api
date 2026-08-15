# Submit 1.0.16 (Build 81) — new train after 1.0.15 approved

**Why:** Codemagic rejected `1.0.15` / Build 80 upload with Apple errors:

- `90186` — Pre-release train `1.0.15` is **closed** for new build submissions
- `90062` — `CFBundleShortVersionString` [1.0.15] must be higher than previously approved [1.0.15]

## iOS

- `MARKETING_VERSION = 1.0.16`
- `CURRENT_PROJECT_VERSION = 81`

Includes profile load + scroll/tab cover fix from #444 (and anything else already on `main` since 1.0.15).

## App Store Connect (you)

1. **Apps → GatorVault → + Version → 1.0.16** (if ASC does not auto-create it)
2. Re-run Codemagic **iOS Release Build** on `main` after this merges
3. When processing finishes, attach the new build to **1.0.16** / TestFlight

## Codemagic

Workflow **iOS Release Build** on `main` after this merges.
