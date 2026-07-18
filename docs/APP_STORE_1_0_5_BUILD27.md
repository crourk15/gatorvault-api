# Submit 1.0.5 (Build 27) — App Store / TestFlight

**On `main` now:** player-nav landing bounce fix (#97) + welcome email URL fix (#96).  
**iOS:** `MARKETING_VERSION = 1.0.5`, `CURRENT_PROJECT_VERSION = 27`.  
**Codemagic:** `ios-release` has `submit_to_app_store: true` (auto-submit after upload).

This cloud agent cannot start Codemagic (no `CM_API_TOKEN` / `CODEMAGIC_APP_ID` here).

---

## 1) Start Codemagic (you click this)

1. Open https://codemagic.io → **gatorvault-api**
2. Workflow **iOS Release Build** (`ios-release`)
3. Branch **`main`**
4. **Start new build**
5. Wait until the build is **green** (often 15–30 min)

## 2) App Store Connect

1. https://appstoreconnect.apple.com → **Apps** → **GatorVault Insider** → version **1.0.5**
2. If an older 1.0.5 build is still **Waiting for Review**, remove it from review first, then attach **Build 27**
3. Confirm **Whats New** matches `release_notes.json` (or paste below)
4. Confirm demo account still:
   - Email: `appreview@gatorvaultinsider.com`
   - Password: (unchanged)
5. Confirm status moves to **Waiting for Review** (Codemagic may submit automatically)

## Whats New (paste if empty)

```
Player profiles stay inside the vault — tapping names on FutureCast Early Discovery and target boards no longer dumps you on the marketing page. Sign-in sticks more reliably on iPhone. Membership no longer bounces home on a network blip. Welcome email member link now points to gatorvaultinsider.com.
```

## TestFlight smoke (before trusting review)

1. FutureCast → Early Discovery 2028 → tap any name (e.g. Cassell Cruickshank) → profile stays in vault
2. Recruiting → 2028 Targets → tap any name → stays in vault
3. Team → tap a roster player → stays in vault
4. Force-quit → reopen → still signed in
5. Membership loads without bouncing to marketing `/`

## Email follow-up (API)

After Render deploys `main`, re-paste `server/emailjs-welcome-template.html` into EmailJS if the dashboard HTML still shows `gatorvault.com/vault`.
