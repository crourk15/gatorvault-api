# Codemagic — First iOS / TestFlight Build

Use this after App Store Connect metadata is ready. Builds run on Codemagic Mac servers (no local Mac required).

## Prerequisites

- Apple Developer Program **active**
- App record in Connect: `com.gatorvaultinsider.app`
- Git repo connected to [Codemagic](https://codemagic.io)

## Step 1 — App Store Connect API key

1. [App Store Connect](https://appstoreconnect.apple.com) → **Users and Access** → **Integrations** → **App Store Connect API**
2. **Generate API Key** (role: **App Manager** or **Admin**)
3. Download the `.p8` file (one-time download)
4. Note **Issuer ID** and **Key ID**

## Step 2 — Codemagic integration (Personal Account)

1. Codemagic → **Settings** (left sidebar) → **Integrations** → **Developer Portal**
2. Add key named **`codemagic`** (must match `codemagic.yaml`)
3. Paste Issuer ID, Key ID `5H84AX8C73`, and upload `.p8`

## Step 3 — Certificate private key (required once)

`fetch-signing-files --create` needs a distribution key stored in Codemagic:

1. Generate on Windows (PowerShell):

```powershell
openssl genrsa -out ios_distribution_private_key.pem 2048
```

2. Codemagic → **gatorvault-api** → **Environment variables**
3. Add group `code-signing` with secret **`CERTIFICATE_PRIVATE_KEY`** = full PEM contents (including BEGIN/END lines)
4. Add to `codemagic.yaml` under `environment.groups` if not using UI automatic cert

**Or** in app **Distribution → iOS code signing → Generate certificate** (Codemagic manages the key for you).

## Step 4 — iOS code signing in app

1. Open **gatorvault-api** (not just Builds)
2. **Distribution** or **Code signing identities**
3. **Automatic** + key **`codemagic`** + bundle `com.gatorvaultinsider.app`
4. **Generate certificate** → **Fetch profile** (App Store) → **Save**

## Step 5 — Start a build

1. Push latest `main` (includes `codemagic.yaml`)
2. Codemagic → **GatorVault** → workflow **iOS Release Build** → **Start new build**
3. First build may take 15–30 min (npm + Next build + archive)

## Step 6 — After build succeeds

1. Connect → **TestFlight** tab → wait for build **Processing** → **Ready to Submit** (5–30 min)
2. **Distribution** → **1.0 Prepare for Submission** → **Build** → **+** → select build **1.0 (1)**
3. Export compliance: encryption **Yes** → standard HTTPS → **exempt** (also set in Info.plist)
4. **Add for Review**

## Troubleshooting

| Error | Fix |
|-------|-----|
| Integration not found | Rename integration in Codemagic to match `integrations.app_store_connect` in `codemagic.yaml` |
| No matching profiles found | Add `CERTIFICATE_PRIVATE_KEY` env var OR Generate certificate in app Distribution settings; rebuild after yaml fix on `main` |
| Bundle ID mismatch | Must be `com.gatorvaultinsider.app` |
| Build fails on `npm run build` | Check Codemagic build log; fix Next.js errors |
| Upload OK but no build in Connect | Wait 30 min; check email for Apple processing errors |

## Version bumps

Before each new upload, increment in Xcode project (`client/ios/App/App.xcodeproj`):

- **MARKETING_VERSION** = App Store version (e.g. `1.0`)
- **CURRENT_PROJECT_VERSION** = build number (e.g. `2`, `3`, …)

## Workflow file

Root `codemagic.yaml` — workflow id: `ios-release`

## Optional before review

Replace placeholder app icon: `client/mobile/resources/README.md`