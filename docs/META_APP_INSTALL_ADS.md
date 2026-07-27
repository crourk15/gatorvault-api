# Meta App Install ads — GatorVault setup

This wires the **Facebook iOS SDK (App Events)** so Ads Manager can select GatorVault for **App promotion** campaigns.

## What is already in the repo

- `FBSDKCoreKit` CocoaPod
- `AppDelegate` initializes Meta SDK + `activateApp`
- `Info.plist` placeholders for App ID / Client Token + SKAdNetwork IDs

## What only you can do (≈10 minutes)

### 1) Create the Facebook app

1. Open [developers.facebook.com](https://developers.facebook.com) (same Facebook login)
2. **My Apps** → **Create App**
3. Use case: **Other** / **Business** (or **App ads** if shown)
4. App name: `GatorVault`
5. Contact email: yours
6. Business portfolio: **Gator Vault** if asked

### 2) Copy two values

In the Facebook app dashboard:

1. **Settings → Basic**
2. Copy **App ID**
3. Copy **Client Token** (Settings → Advanced, or Basic → show client token)

### 3) Paste into the iOS project

Edit `client/ios/App/App/Info.plist`:

| Key | Value |
|---|---|
| `FacebookAppID` | your App ID (numbers only) |
| `FacebookClientToken` | your client token |
| `CFBundleURLSchemes` entry `fbREPLACE_FACEBOOK_APP_ID` | `fb` + App ID (example: `fb1234567890`) |

Do **not** leave `REPLACE_FACEBOOK_*` in a shipping build.

### 4) Link Business + ad account

1. Facebook app → **Settings → Basic** → add **Gator Vault** business if needed
2. **Business settings** → **Accounts → Apps** → add this Facebook app
3. Assign ad account **GatorVault Ads** to the app
4. **Events Manager** → connect the app (App Store ID `6783848215`)

### 5) Ship an App Store build

Push the filled plist → Codemagic iOS release → App Store / TestFlight → release.

Install measurement only works for users on a build that includes the SDK + real App ID.

### 6) Resume App promotion

1. Ads Manager → **GatorVault Ads**
2. Create **App promotion** campaign
3. App field should now list **GatorVault**
4. Budget `$5/day`, optimize for app installs

## If App still won’t select

Ask Meta beta:

```
Facebook iOS SDK and App Events are integrated. App ID is <YOUR_APP_ID>.
Ad account GatorVault Ads is assigned. App Store ID 6783848215.
Why can’t I select GatorVault in App promotion?
```

## Security

- Client token is expected in the iOS binary (Meta’s model)
- Do not commit Facebook **App Secret**
