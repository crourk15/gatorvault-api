# Submit 1.0.9 (Build 42) — new train after 1.0.8 approved

**Why:** Codemagic rejected `1.0.8` / Build 41 upload with Apple errors:

- `90062` — `CFBundleShortVersionString` [1.0.8] must be higher than previously approved [1.0.8]
- `90186` — Pre-release train `1.0.8` is **closed** for new build submissions

So TestFlight staying on **1.0.8 (36)** is expected: Apple will not accept any more `1.0.8` binaries. Open a new version train.

## iOS

- `MARKETING_VERSION = 1.0.9`
- `CURRENT_PROJECT_VERSION = 42`

Includes everything since Build 36 that never landed (Associated Domains, elite harden, Community, name-display fix, Codemagic profile + build-number fixes).

## App Store Connect (you)

1. **Apps → GatorVault → Distribution** (or TestFlight) → **+ Version** → **1.0.9**
2. Wait for Codemagic **ios-release** to publish **42**
3. When processing finishes, attach **42** to **1.0.9** / TestFlight

## Codemagic

Workflow **iOS Release Build** on `main` after this merges.
