# Meta iOS App Install ads

## What is wired in the iOS app

- Facebook App ID: `2339620876443889`
- Client Token: `client/ios/App/App/Info.plist` (`FacebookClientToken`)
- SDK: `FBSDKCoreKit` via CocoaPods (`client/ios/App/Podfile`)
- Init: `AppDelegate.swift` -- App Events + ATT prompt (delayed)
- SKAdNetwork: Meta-oriented ID list in `Info.plist`

Do not commit or paste the App Secret into the app.

## Why Ads Manager said AEM was missing

iOS 14+ App Install campaigns need the Facebook SDK reporting conversion data. Until a build with this SDK is live (or at least installed from TestFlight and opened), Meta shows that Aggregated Event Measurement is missing or partial.

## Ship checklist

1. Merge this change to `main`
2. App Store Connect: ensure version 1.0.12 (or next) is open
3. Codemagic -> iOS Release Build from `main` (pods install pulls `FBSDKCoreKit`)
4. Install from TestFlight -> open the app once (sends activate / install signals)
5. Ads Manager -> GatorVault Ads (`1072360225309877`) -> App Install draft -> select GatorVault -> Publish
6. Pause website-traffic campaigns once App Installs is live

## Organic posts (no spend)

Page/group image posts with App Store URL only -- separate from paid App Install campaigns.

## New ad paste pack (creatives + copy)

Ready-to-upload Meta sizes + Ads Manager copy:

→ [`docs/promo/open-the-vault/META-APP-INSTALL-AD.md`](./promo/open-the-vault/META-APP-INSTALL-AD.md)

Exports folder: `docs/promo/open-the-vault/meta-exports/` (1080 feed, 9:16 story, reel).
