# GatorVault iOS (Capacitor)

Additive native shell — **does not change** the Netlify web deploy. The App Store app bundles the same static export as the website and calls the production API.

## Prerequisites

- **Mac with Xcode 15+** (required to build and submit to the App Store)
- Node 18+ (same as the web app)
- Apple Developer account (for device testing and App Store Connect)

## First-time setup (Mac)

```bash
cd client
npm install
npm run build
npm run cap:sync
npm run cap:ios          # opens Xcode
```

In Xcode:

1. Select the **App** target → **Signing & Capabilities** → your Team
2. Set **Bundle Identifier** to `com.gatorvaultinsider.app` (or your registered ID)
3. Add app icons (see `client/mobile/resources/README.md`)
4. Run on Simulator or a physical device

## Day-to-day workflow

```bash
# From repo root
npm run mobile:sync      # build client + copy into ios/

# Or from client/
npm run build && npm run cap:sync
npm run cap:ios
```

## Live-site dev mode (optional)

Point the WebView at production/staging **only for local debugging** — do **not** ship this build to App Review:

```bash
# Mac / Linux
CAPACITOR_SERVER_URL=https://gatorvaultinsider.com/vault/ npm run cap:sync

# Windows PowerShell
$env:CAPACITOR_SERVER_URL="https://gatorvaultinsider.com/vault/"
npm run cap:sync
```

Unset `CAPACITOR_SERVER_URL` before App Store builds. The default config bundles static assets from `client/out` (required for Guideline 4.2.2).

## App Store resubmission (June 2026 review)

Apple rejected **1.0 (5)** for:

1. **2.3.8 — placeholder app icons** — Replace `AppIcon-512@2x.png` in `ios/App/App/Assets.xcassets/AppIcon.appiconset/` and `client/mobile/resources/icon.png` with the finalized GatorVault mark (1024×1024). Re-run `npm run build:mobile` on Mac before archiving.
2. **4.2.2 — minimum functionality** — Build with **bundled** assets (no `CAPACITOR_SERVER_URL`). Highlight native features in Review Notes: StoreKit subscription (`@capgo/native-purchases`), status bar/splash, offline shell, push alerts UI.

Suggested Review Notes reply:

> GatorVault Insider bundles the full vault experience locally. Native StoreKit handles Insider subscription purchase and restore. The app is not a generic browser — it is a dedicated Gators command center with offline-capable shell, native IAP, and curated Florida football intel.

## App Store checklist

- [x] Replace placeholder icons (`client/mobile/resources/icon.png` + Xcode AppIcon set)
- [ ] Archive with bundled build (`npm run build:mobile`, no live server URL)
- [ ] StoreKit / IAP live sandbox test on device before resubmit

| Piece | Location |
|-------|----------|
| Capacitor config | `client/capacitor.config.ts` |
| iOS project | `client/ios/` |
| Native API origin | `client/lib/api-base.ts` → `https://gatorvaultinsider.com` |
| Shell init (status bar, splash, back) | `client/lib/native-shell.ts` |
| Native IAP (StoreKit) | `client/lib/native-app-entry.ts` |

## Architecture

| Piece | Location |
|-------|----------|
| Service worker | `client/public/push-sw.js` |
| Alerts UI | `/vault/alerts/` → `VaultAlertsPage.tsx` |
| API | `POST /api/push/subscribe`, `/unsubscribe`, `GET /api/push/config` |
| Server env | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `PUSH_ALERTS_ENABLED=true` on Render |

Enable on a member account: sign in → **My Alerts** → Push + Visits → Save. Cache-bust no longer unregisters `push-sw.js`.

Native iOS push requires APNs key + Capacitor plugin (Step 5b — not started).

## Windows note

You can commit and edit the Capacitor project on Windows. **Building and submitting requires a Mac** — or use **Codemagic** (`docs/CODEMAGIC_IOS.md`, root `codemagic.yaml`).
