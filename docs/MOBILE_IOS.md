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

Point the WebView at production/staging without rebuilding static assets:

```bash
# Windows PowerShell
$env:CAPACITOR_SERVER_URL="https://gatorvaultinsider.com"
npm run cap:sync --prefix client
```

Unset `CAPACITOR_SERVER_URL` for bundled (offline shell) builds.

## Architecture

| Piece | Location |
|-------|----------|
| Capacitor config | `client/capacitor.config.ts` |
| iOS project | `client/ios/` |
| Native API origin | `client/lib/api-base.ts` → `https://gatorvaultinsider.com` |
| Shell init (status bar, splash, back) | `client/lib/native-shell.ts` |

## App Store checklist (later steps)

- [ ] Replace placeholder icons/splash (`client/mobile/resources/`)
- [ ] StoreKit / IAP (Step 3)
- [ ] Push notifications (Step 5)
- [ ] Universal links / AASA (Step 8)
- [ ] Privacy Policy URL in App Store Connect → `/privacy/`

## Windows note

You can commit and edit the Capacitor project on Windows. **Building and submitting requires a Mac** — or use **Codemagic** (`docs/CODEMAGIC_IOS.md`, root `codemagic.yaml`).
