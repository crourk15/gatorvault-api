# Submit 1.0.5 (Build 25) — App Store Connect

**Preferred path:** Codemagic auto-submit (this repo now has `submit_to_app_store: true` + `release_notes.json`).

**Binary includes:** Session kickout fix, Membership load/retry fix, Join stickiness, trial ledger, HS/hometown, Game Zone + Alerts fan-copy cleanup.

This cloud agent has **no App Store Connect API key or Apple login**, so it cannot click Submit in Connect from here. Starting Codemagic on `main` is the forward path.

---

## Path A — Codemagic (recommended)

1. Codemagic → **gatorvault-api** → workflow **iOS Release Build** (`ios-release`) → **Start new build** on branch **`main`**
2. Wait until the build is **green**
3. Wait for App Store Connect post-processing (TestFlight + review submit)
4. Open https://appstoreconnect.apple.com → **Apps** → **GatorVault Insider** → **1.0.5**
5. Confirm status is **Waiting for Review** (or that a review submission was created)
6. Confirm **Whats New** matches `release_notes.json` / paste block below if empty
7. Confirm **App Review Information** still has demo account:
   - Email: appreview@gatorvaultinsider.com
   - Password: (same value already in Connect — do not change)
8. Confirm age rating **Gambling = No**

If Codemagic uploaded to TestFlight but did **not** create a review submission, use Path B.

---

## Path B — Manual Connect (fallback)

1. Open https://appstoreconnect.apple.com → **Apps** → **GatorVault Insider**
2. Open version **1.0.5** (create it with **+** if needed)
3. **Build** → select **25** (1.0.5) — wait until the build is ready if still processing
4. **Whats New in This Version** — paste block below
5. Confirm demo account + reviewer notes (optional refresh below)
6. Confirm age rating **Gambling = No**
7. **Add for Review** → **Submit to App Review**

Do **not** change auth/IAP/demo password for this submit.

Optional local automation (needs your Apple login on your machine):

```bash
ASC_EMAIL='…' ASC_PASSWORD='…' node scripts/asc-create-submit-1-0-5.cjs
```

---

## Whats New (paste)

```
Membership & Account stays open if the network blips — no more bounce to the landing page. Sign-in no longer drops while you browse FutureCast and other vault tabs. Player high school vs hometown display fix. Game Zone and Alerts fan-facing copy cleanup.
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
