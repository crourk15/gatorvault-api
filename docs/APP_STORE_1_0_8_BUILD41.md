# Submit 1.0.8 (Build 41) — after Build 40 publish reject

**Why:** Codemagic archived **1.0.8 (40)** successfully (Associated Domains profile fix worked), then **Publishing** failed with `Failed to publish App.ipa to App Store Connect`. Same class of failure as Build **33** → **34** when ASC already has that `CFBundleVersion` (duplicate), or when a concurrent upload claimed **40**.

## iOS

- `MARKETING_VERSION = 1.0.8` (unchanged)
- `CURRENT_PROJECT_VERSION = 41`
- Codemagic step **Set next TestFlight build number** auto-raises above the latest ASC/TestFlight build if needed

## Codemagic

1. Merge this bump to `main`
2. Workflow **iOS Release Build** (`ios-release`) runs on `main`
3. Confirm logs:
   - Refresh profile: Push + Associated Domains OK
   - Set next TestFlight build number: `using=41` (or higher)
   - Build IPA OK
   - Publishing OK → TestFlight

## First check in App Store Connect

Before assuming publish is still broken: open **TestFlight** and see if **40** already landed from the successful archive. If **40** is processing/ready, you can use it; **41** is the safe re-upload either way.
