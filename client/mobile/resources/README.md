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

**Status:** Splash PNGs in `ios/.../Splash.imageset/` are GatorVault-branded (navy `#0a1628` + wordmark). Do not ship the default Capacitor “blue capacitor” splash — that white screen was a first-open drop-off.

`icon.png` / AppIcon should use the finalized GatorVault 1024×1024 mark before each App Store archive.
