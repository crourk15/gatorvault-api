# App Store 1.0.3 — Build 14

**Why:** Ship the Vault cache-first + live refresh client so iPhone members get instant revisits (same fix already on web via Netlify). Also picks up Render hub-warm / Standard memory tuning for faster first loads.

**Version:** marketing `1.0.3` · build `14`  
**Bundle:** `com.gatorvaultinsider.app`

**Depends on:** `1.0.2` / Build 13 may still be Waiting for Review. Prefer let 1.0.2 finish approval, then submit **1.0.3**. Or remove 1.0.2 from review and submit 1.0.3 if you want speed in the next review cycle only.

## What's New (paste into App Store Connect)

Faster Vault loading — Home, Recruiting, and Team show your last boards instantly, then refresh live in the background.

## Build path (Codemagic)

1. Push this commit to `main`
2. Codemagic → workflow **iOS Release Build** (`ios-release`) → Start
3. Wait for TestFlight processing
4. App Store Connect → version **1.0.3** → select build **14** → Submit for Review

## After approval

Phased release optional. On device: open Team / Recruiting once, leave, reopen — should feel near-instant on the second open.
