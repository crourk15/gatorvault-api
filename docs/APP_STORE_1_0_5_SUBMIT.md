# Submit 1.0.5 (Build 17) — App Store Connect

**When:** After Codemagic uploads **1.0.5 (17)** to App Store Connect / TestFlight.
**Binary includes:** player/article nav fixes, My Alerts + APNs client, Battle Board RPM honesty, push entitlements.

## Steps (Apple login required)

1. Open https://appstoreconnect.apple.com → **Apps** → **GatorVault Insider**
2. **+** version (or open existing) → marketing version **1.0.5**
3. **Build** → select **17** (1.0.5)
4. **Whats New in This Version** — paste block below
5. Confirm **App Review Information** still has demo account:
   - Email: ppreview@gatorvaultinsider.com
   - Password: (same value already in Connect — do not change)
6. **Notes for reviewer** — paste review notes block below (optional refresh)
7. Confirm age rating **Gambling = No** (do not set Yes)
8. **Add for Review** → **Submit to App Review**

Do **not** pull Build 15 / live 1.0.4 for unrelated reasons. Do **not** change auth/IAP/demo password for this submit.

---

## Whats New (paste)

`
Player profiles and Insider articles open correctly on iPhone. My Alerts can send visit, commit, and Gators score notifications when you allow them. Battle Board shows confirmed On3 UF RPM only — no estimated percentages. Builds on 1.0.4.
`

---

## Notes for reviewer (paste)

`
GatorVault Insider — demo account has full Insider / War Room access.

SIGN IN: On the join screen tap Sign in (not Create account).
Email: appreview@gatorvaultinsider.com
Password: (see App Review Information field)

REVIEW PATHS
1. Recruiting → tap any player name → profile should open
2. Team → scroll to Recruiting Pipeline map (full-width bars on phone)
3. Film Room → open a presser/video (no Error 153)
4. Game Week → /vault/game-week/
5. Gators Live → /vault/live-scores/ (season-ready card until kickoff)
6. Articles → /vault/articles/ → open any article
7. My Alerts → /vault/alerts/ (Visits / Commits / Scores; allow notifications if prompted)
8. Membership → /vault/membership/ (do NOT delete the demo account)
9. Legal → https://gatorvaultinsider.com/privacy/ and /terms/

Support: support@gatorvaultinsider.com
`

---

## Ops checklist (server) before expecting lock-screen pushes

1. Apple Developer → Keys → Apple Push Notifications key (.p8) + Key ID
2. App ID com.gatorvaultinsider.app → Push Notifications enabled
3. Render gatorvault-api env: APNS_KEY_ID, APNS_TEAM_ID=45C4DZJ4UJ, APNS_BUNDLE_ID=com.gatorvaultinsider.app, APNS_KEY_P8, APNS_PRODUCTION=true, PUSH_ALERTS_ENABLED=true
4. Codemagic provisioning profile includes Push
5. After install: My Alerts → enable Visits + Push → Save → allow system prompt
