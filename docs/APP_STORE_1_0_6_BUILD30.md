# Submit 1.0.6 (Build 30) — App Store / TestFlight

**Why not 1.0.5 / 29:** App Store Connect closed the 1.0.5 train after build 28 was approved. New binaries must ship a higher `CFBundleShortVersionString` (error 90186 / 90062).

**iOS:** `MARKETING_VERSION = 1.0.6`, `CURRENT_PROJECT_VERSION = 30`.  
**Codemagic:** workflow `ios-release` on branch `main` (`submit_to_app_store: true`).

Same shell-trust payload as the failed 1.0.5 (29) attempt (menu, hydration, vault links, podcasts-first).

## Start Codemagic

1. https://codemagic.io → **gatorvault-api**
2. Workflow **iOS Release Build** (`ios-release`)
3. Branch **`main`**
4. **Start new build**

## App Store Connect

1. Create version **1.0.6** (or open it if already created)
2. Attach build **30** after processing
3. Paste Whats New from `release_notes.json` if empty
4. Confirm demo account unchanged
5. Submit for review

## Whats New

```
Menu opens reliably on Home. Links stay inside the vault app shell. Podcasts open to the podcasts section without a scroll jump. Sign-in and player navigation remain more stable on iPhone.
```
