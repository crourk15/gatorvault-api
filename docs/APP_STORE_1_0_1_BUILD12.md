# App Store 1.0.1 — Build 12 (resubmit)

**Why:** App Store 1.0 / Build 11 was archived ~Jul 8 (bundled Capacitor shell). Web/API upgrades since then are not in that binary.

**Version:** marketing `1.0.1` · build `12`
**Bundle:** `com.gatorvaultinsider.app`

## What's New (paste into App Store Connect)

FutureCast Closing Class now shows Florida's remaining live board. Faster GatorNation Live beat feed and ticker. Recruiting and Lab polish from July.

## Build path (Codemagic — preferred)

1. Push this commit to `main`
2. Codemagic → workflow **iOS Release Build** (`ios-release`) → Start
3. Wait for TestFlight processing
4. App Store Connect → version **1.0.1** → select build **12** → Submit for Review

Codemagic runs a fresh client static export + `cap sync ios` with no `CAPACITOR_SERVER_URL`.

## Build path (local Mac)

unset CAPACITOR_SERVER_URL
npm run mobile:sync
# Xcode → Archive → Distribute → confirm 1.0.1 (12)

## After approval

Release (phased 7-day recommended). Reinstall on device and confirm Closing Class + GNL look current.