# App Store Resolution — July 6, 2026 (Submission 475e2270)

Apple rejected **1.0 (9)** on iPad Air 11-inch. Four items before resubmit.

---

## Engineering (done in this commit)

### 2.1(a) — Unlock → login redirect

**Bug:** Tapping **Unlock Game Week + Film Room** sent reviewers to sign-in instead of membership/IAP.

**Fix (build 11):** Logged-in users route to **Membership & Account** (`/vault/membership/?upgrade=film`), not `/join`. Unlock CTAs also **recompute at session load and on click** so iPad/Capacitor never keeps a stale `/join` href after sign-in.

**Code:** `insiderUnlockHref()` + `useInsiderUnlock()` in `client/lib/useUser.ts`; wired into Game Week, Film Room, and FutureCast paywalls.

**iOS build:** **1.0 (11)** in `client/ios/App/App.xcodeproj/project.pbxproj`.

Before resubmit:
1. Deploy web (Netlify) after push
2. Codemagic iOS build **1.0 (11)**
3. Reprovision demo: `node scripts/provision-app-review-account.js`
4. iPad test: demo War account → Game Week / Film Room **no paywall**; free logged-in user → Unlock → **Membership**, not sign-in

---

## Your tasks in App Store Connect

### 2.1(b) — Submit IAP products for review

Apple cannot finish review until subscriptions are submitted **with** a new binary.

1. **Monetization → Subscriptions** → group **GatorVault Insider**
2. For **each** of the 6 products, open the product → **Submit for Review**:
   - `com.gatorvaultinsider.locker.monthly`
   - `com.gatorvaultinsider.locker.annual`
   - `com.gatorvaultinsider.film.monthly`
   - `com.gatorvaultinsider.film.annual`
   - `com.gatorvaultinsider.war.monthly`
   - `com.gatorvaultinsider.war.annual`
3. Each product needs an **App Review screenshot** (capture Membership screen on iPhone/iPad showing that tier’s subscribe button)
4. Upload binary **1.0 (10)** → attach to version 1.0 → **Add for Review** (app + IAPs go together)

Optional before review week: set `APPLE_IAP_VERIFICATION_ENABLED=true` on Render (see `docs/APP_STORE_SUBSCRIPTIONS.md`).

### 2.3.6 — Age rating: Gambling = Yes

**General → App Information → Age Ratings → Edit**

Set **Gambling → Yes** (informational betting lines/spreads in Game Week; no real-money wagering in-app). Save.

See `docs/APP_STORE_CONNECT_REMAINING.md` for full questionnaire answers.

### 5.1.1(v) — Account deletion screen recording

Already in app: **Menu → Membership & Account → Delete account** (password + type `DELETE`).

Record on a **throwaway** account (not `appreview@`). Steps: `docs/APP_STORE_RESUBMISSION.md`.

Attach video in **App Review Information → Notes** (or link in Resolution Center reply).

---

## Resolution Center reply (paste into App Store Connect)

```
Hello App Review,

Thank you for the detailed feedback on submission 475e2270 (1.0 build 9). We have addressed all four items in build 1.0 (11) and App Store Connect metadata updates.

Guideline 2.1(a) — Unlock redirect:
We fixed a routing bug where logged-in users tapping "Unlock Game Week + Film Room" were sent to the sign-in page instead of Membership & Account (In-App Purchase). Logged-in users now land on /vault/membership/ with the correct upgrade tier. We tested on iPad with the demo account below.

Guideline 2.1(b) — In-App Purchases:
We have submitted all six auto-renewable subscription products for review with App Review screenshots and attached binary 1.0 (11):
- com.gatorvaultinsider.locker.monthly / .annual
- com.gatorvaultinsider.film.monthly / .annual
- com.gatorvaultinsider.war.monthly / .annual

Guideline 5.1.1(v) — Account deletion:
Account deletion is available in-app: Menu → Membership & Account → Delete account. Users enter their password and type DELETE to permanently delete the account (not deactivation). A screen recording of the full flow is included in App Review Information / attached to this reply. Please do not delete the demo account below.

Guideline 2.3.6 — Age rating:
We updated Age Ratings to select Yes for Gambling, reflecting informational betting lines and spreads shown in Game Week (no real-money wagering in the app).

Demo account (War Room — full access):
Email: appreview@gatorvaultinsider.com
Password: [same as App Review Information field]

Sign in: tap "Sign in" on the join screen (not Create account).

Review paths after sign-in:
1. Game Week — /vault/game-week/
2. Film Room — /vault/film-room/
3. FutureCast — /vault/futurecast/
4. Membership & IAP — /vault/membership/
5. Account deletion UI — /vault/membership/#delete-account (demo account only — do not delete)
6. Community UGC — /vault/community/ (Report / Block)
7. Privacy & Terms — /privacy/ and /terms/

Support: support@gatorvaultinsider.com

Thank you,
Charles Rourk
```

---

## Resubmit checklist

- [x] Netlify deploy live (`70f1483` — verified via build-manifest.json)
- [x] Demo account reprovisioned on production (War tier, smoke 19/19)
- [x] Age rating: **Gambling = Yes** (18+)
- [ ] Codemagic / App Store Connect binary **1.0 (11)** attached (replace Build 9)
- [ ] 6 IAP products complete + **Submitted for Review** with screenshots (2/6 started — see `docs/APP_STORE_IAP_FINISH.md`)
- [ ] Account deletion screen recording in Review Notes
- [ ] Resolution Center reply pasted
- [ ] Version 1.0 → **Add for Review**

---

## Charles only (~15 min) — everything else is done

### App Store Connect (your Apple login)
1. **Age rating:** General → App Information → Age Ratings → **Gambling = Yes** → Save
2. **IAP:** Monetization → Subscriptions → submit all 6 products with screenshot `docs/app-store-screenshots/05-membership.png`
3. **Binary:** attach **1.0 (11)** when Codemagic finishes
4. **Notes:** paste App Review block from `docs/app-store-screenshots/APP_STORE_CONNECT_PASTE.txt`
5. **Resolution Center:** paste reply block from this file (bottom)
6. **Add for Review**

### iPhone only — deletion video (5 min)
Record throwaway account flow per `docs/APP_STORE_RESUBMISSION.md` → attach in App Review Notes.

**Do not delete** `appreview@gatorvaultinsider.com`.
