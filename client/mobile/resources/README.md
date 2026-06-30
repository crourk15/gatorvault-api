# iOS app icons and splash

Capacitor/Xcode need **PNG** assets (SVG logos in `public/brand/` are not used directly).

## Required (minimum for App Store)

1. **App icon** — 1024×1024 PNG, no transparency, no rounded corners (Apple masks automatically)
2. **Splash** — 2732×2732 PNG, dark swamp background `#0a1628`, centered GatorVault wordmark or monogram

## Generate with Capacitor Assets (recommended)

On a Mac, after adding a 1024×1024 `icon.png` and 2732×2732 `splash.png` here:

```bash
cd client
npm install -D @capacitor/assets
npx capacitor-assets generate --ios
npm run cap:sync
```

## Manual Xcode

Drag icon sets into **Assets.xcassets → AppIcon** in `client/ios/App/App/`.

Until custom PNGs exist, the default Capacitor placeholder icon is used for development only — replace before App Store submission.

**Status:** `icon.png` and `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` should use the finalized GatorVault 1024×1024 mark before each App Store archive.
