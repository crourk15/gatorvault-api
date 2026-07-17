# App Store 1.0.5 — Build 16

**Status:** Ready to build — packs nav fixes + alerts + Battle Board RPM honesty.

**Version:** marketing 1.0.5 · build 16
**Bundle:** com.gatorvaultinsider.app

## Already on main (rides in this binary)

1. **Honest My Alerts + APNs** (d582e99) — Visits / Commits / Scores as lock-screen categories; Capacitor push + device token API; commit + Gators score dispatch.
2. **Battle Board UF RPM honesty** (ef94a33) — never invent UF RPM from heat/fit; only confirmed On3 RPM (or real competitor boards).

## New in this commit (must ship in 16)

3. **Player profile taps (iOS)** — Capacitor catch-all SPA nav so taps open profiles instead of bouncing home.
4. **Articles reader (iOS)** — in-vault /vault/articles/{id} catch-all + reader; list links stay under /vault/.
5. **Push entitlements** — App.entitlements with production APS env wired into the Xcode target; marketing 1.0.5 / build 16.

## Whats New (paste into App Store Connect)

Player profiles and Insider articles open correctly on iPhone. My Alerts can send visit, commit, and Gators score notifications when you allow them. Battle Board shows confirmed On3 UF RPM only — no estimated percentages. Builds on 1.0.4.

## Before Codemagic

1. Codemagic has named cert **`gatorvault_appstore`** + ASC integration **`codemagic`**
2. Render API env (for lock-screen pushes after install): APNS_KEY_ID, APNS_TEAM_ID, APNS_KEY_P8, APNS_BUNDLE_ID=com.gatorvaultinsider.app, APNS_PRODUCTION=true
3. Codemagic → **iOS Release Build** on this branch / `main` — profile refresh with Push is automatic

## Device smoke after install

- Recruiting / FutureCast: tap player name → profile
- Articles: open an article → reader → back
- My Alerts: enable Visits + Push → Save → allow system permission
- Battle Board: no fake 100% rows without On3 RPM

## Do not

- Fold auth / IAP / demo-account changes into 16 without explicit confirmation
