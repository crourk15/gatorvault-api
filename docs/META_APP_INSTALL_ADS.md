# Meta iOS App Install ads

## What is wired in the iOS app

- Facebook App ID: `2339620876443889`
- Client Token: `client/ios/App/App/Info.plist` (`FacebookClientToken`)
- SDK: `FBSDKCoreKit` via CocoaPods (`client/ios/App/Podfile`)
- Init: `AppDelegate.swift` -- App Events + ATT prompt (delayed)
- SKAdNetwork: Meta-oriented ID list in `Info.plist`

Do not commit or paste the App Secret into the app.

## App Store IDs (verified live)

| Field | Value |
|-------|--------|
| **iPhone / App Store ID** (use this) | `6783848215` |
| Bundle ID | `com.gatorvaultinsider.app` |
| App Store name | GatorVault Insider |
| Seller | GatorVault Media, LLC |
| Developer / artist ID (do **not** use) | `6783848217` |
| Meta Facebook App ID | `2339620876443889` |
| Live URL | https://apps.apple.com/us/app/gatorvault-insider/id6783848215 |

Apple’s iTunes lookup returns the app; if Ads Manager says **Could not find App with ID 6783848215**, the ID is still right — Meta’s “Add new app” store crawl failed.

### Fix: claim Store ID on the Facebook app (do this first)

Do **not** keep retrying “Add new app” with only the numeric ID. Wire the store listing to the existing Meta app, then pick that app in Ads Manager.

1. Open [Meta for Developers → My Apps](https://developers.facebook.com/apps) → **GatorVault** (`2339620876443889`)
2. **Settings → Basic** → scroll to **iOS** (or **+ Add platform → iOS**)
3. Set:
   - **Bundle ID:** `com.gatorvaultinsider.app`
   - **iPhone Store ID:** `6783848215`
   - (optional) **iPad Store ID:** same `6783848215`
4. **Save changes**
5. Confirm the ad account can use the app: **Settings → Advanced** / app roles — your Business / ad account `1072360225309877` should be linked (or you are Admin on the app)
6. Back in Ads Manager → App promotion → **select the app from the dropdown** (search **GatorVault** / Facebook App ID), **not** “Add new app” by Store ID

### If the dropdown still doesn’t show it

- Paste the **full** store URL instead of digits only:  
  `https://apps.apple.com/us/app/gatorvault-insider/id6783848215`
- Events Manager → Data sources → Apps → ensure GatorVault is listed
- App Ads Helper: https://developers.facebook.com/tools/app-ads-helper/
- Wait 15–60 minutes after saving Store ID (Meta catalog lag is common on newer apps)
- Confirm you’re Admin on both the **Facebook app** and the **Page** used for the ad

Do **not** enter developer ID `6783848217` — that is the seller, not the app.

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
