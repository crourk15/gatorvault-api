# Submit 1.0.8 (Build 35) — App Store / TestFlight

**Why this version:** App Store Connect closed the **1.0.7** pre-release train after approval (`90186` / `90062`). New uploads must use a higher `CFBundleShortVersionString`. Build 34 never landed because of that closed train.

## iOS

- `MARKETING_VERSION = 1.0.8`
- `CURRENT_PROJECT_VERSION = 35`

## Codemagic

1. https://codemagic.io → **gatorvault-api**
2. Workflow **iOS Release Build** (`ios-release`)
3. Branch **`main`** (after this bump merges)
4. **Start new build**

## App Store Connect

1. Create version **1.0.8** (new train)
2. Attach build **35** when processing finishes
3. Submit / TestFlight as planned

## Whats New (short)

GatorVault elite platform updates — new marketing train because 1.0.7 is locked after approval.
