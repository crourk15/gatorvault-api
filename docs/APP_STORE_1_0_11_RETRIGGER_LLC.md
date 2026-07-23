# Retrigger 1.0.11 TestFlight — LLC team active

## Why

Apple assigned Program License Agreement to **GatorVault Media, LLC** (team `45C4DZJ4UJ`).
Prior agent leave-off: finish org accept/pay, then re-run Codemagic `ios-release`.

## iOS (unchanged train)

- `MARKETING_VERSION = 1.0.11`
- `CURRENT_PROJECT_VERSION = 70` (Codemagic auto-bumps if ASC already has this build)
- `DEVELOPMENT_TEAM = 45C4DZJ4UJ`
- Codemagic: `submit_to_testflight: true`, `submit_to_app_store: false`

## Ops

1. This commit on `main` triggers GitHub Actions → Codemagic `ios-release`
2. Confirm Publishing succeeds and a new build appears under TestFlight **1.0.11**
3. Finish any open App Store Connect Business / tax tasks so banking/seller stays unblocked
