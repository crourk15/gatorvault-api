# App Store 1.0.4 — Build 15

**Status:** Hold until **1.0.3 / Build 14** clears App Review (Waiting for Review as of Jul 15, 2026).

**Why:** Ship the native player-profile tap fix plus in-vault Articles reader on the phone. Bundle after 14 so we do not interrupt the speed update already in review.

**Version:** marketing `1.0.4` · build `15`  
**Bundle:** `com.gatorvaultinsider.app`

## Include in this binary

1. **Player profile taps (iOS)** — vault/player links soft-nav in the Capacitor shell (hard-nav to missing `{slug}/index.html` was a no-op). Files: `client/lib/native-boot-script.ts`, `client/lib/native-app-entry.ts`, `client/lib/player-slug-from-path.ts`.
2. **Articles** — in-vault reader + gating already in repo; confirm latest `client/components/articles/*` and article routes are on `main` before Codemagic. Publish Charles-approved drafts via GV-OM so content is live on API (content does not require the binary, but the reader UI does).
3. Anything else approved for 15 before Codemagic starts.

## What's New (paste into App Store Connect)

Player profiles open correctly when you tap a name in Recruiting, Team, and FutureCast. In-vault Articles reader. Builds on the faster Vault loading from 1.0.3.

## Build path (after 14 is live)

1. Confirm player-tap fix + articles client are committed on `main`
2. Approve/publish any article drafts Charles wants live
3. Codemagic → **iOS Release Build** (`ios-release`) on `main`
4. App Store Connect → version **1.0.4** → build **15** → Submit for Review

## Do not

- Remove 1.0.3 from review for this
- Fold auth / IAP / demo-account changes into 15 without explicit confirmation
