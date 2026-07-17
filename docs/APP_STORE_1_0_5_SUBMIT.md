# Submit 1.0.5 (Build 23) — App Store Connect

**When:** Codemagic has uploaded **1.0.5 (23)** to App Store Connect / TestFlight (build green + processing complete).

**Binary includes:** Membership native fix, trial/signup hardening, Join login stickiness, HS/location fix, Swamp Eve + Alerts fan-copy cleanup.

This agent environment has **no App Store Connect API key or Apple login**, so Charles must click Submit in Connect (or provide `ASC_KEY_ID` / `ASC_ISSUER_ID` / `.p8` for API automation).

## Steps (Apple login required)

1. Open https://appstoreconnect.apple.com → **Apps** → **GatorVault Insider**
2. Open version **1.0.5** (create it with **+** if needed)
3. **Build** → select **23** (1.0.5) — wait until the build is ready if still processing
4. **Whats New in This Version** — paste block below
5. Confirm **App Review Information** still has demo account:
   - Email: appreview@gatorvaultinsider.com
   - Password: (same value already in Connect — do not change)
6. **Notes for reviewer** — paste review notes block below (optional refresh)
7. Confirm age rating **Gambling = No** (do not set Yes)
8. **Add for Review** → **Submit to App Review**

Do **not** change auth/IAP/demo password for this submit.

---

## Whats New (paste)

```
Membership and account load correctly on iPhone. Sign-in sticks after you create an account — use Sign in with the same email next time. Player high school and hometown show correctly. Game Zone and Alerts copy cleaned up for fans. Builds on recent 1.0.5 TestFlight fixes.
```

---

## Notes for reviewer (paste)

```
GatorVault Insider — demo account has full Insider / War Room access.

SIGN IN: On the join screen tap Sign in (not Create account).
Email: appreview@gatorvaultinsider.com
Password: (see App Review Information field)

REVIEW PATHS
1. Recruiting → tap any player name → profile should open (HS and location should differ when both are known)
2. Team → scroll to Recruiting Pipeline map (full-width bars on phone)
3. Film Room → open a presser/video (no Error 153)
4. Game Week → /vault/game-week/
5. Gators Live → /vault/live-scores/ (season-ready card until kickoff)
6. Articles → /vault/articles/ → open any article
7. My Alerts → /vault/alerts/ (Visits / Commits / Scores; allow notifications if prompted)
8. Membership → /vault/membership/ (do NOT delete the demo account)
9. Legal → https://gatorvaultinsider.com/privacy/ and /terms/

Support: support@gatorvaultinsider.com
```
