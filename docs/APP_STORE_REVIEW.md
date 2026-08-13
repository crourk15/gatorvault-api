# App Store Review Notes (GatorVault Insider)

> **APPROVED (Aug 13, 2026):** App Store **1.0.14** accepted (submission `a28c0e4a-a137-4e51-936b-62bb68e154eb`). Review freeze lifted. Live: https://apps.apple.com/app/gatorvault-insider/id6783848215

**Full Connect copy (description, keywords, screenshots):** `docs/APP_STORE_CONNECT.md`  
**Metadata checklist:** `docs/APP_STORE_METADATA.md`

## Support

- Email: support@gatorvaultinsider.com
- Privacy: https://gatorvaultinsider.com/privacy/
- Terms: https://gatorvaultinsider.com/terms/

## Demo account (App Review)

Enter credentials **only** in App Store Connect (not in git):

- Email: `[REDACTED]`
- Password: same value entered in App Store Connect App Review Information (min 12 characters)
- Tier: War Room (full access)

### Provision on production (required before every resubmit)

```powershell
cd C:\Users\crour\OneDrive\Desktop\gatorvault
$env:SUBSCRIPTION_ADMIN_PIN="YOUR_RENDER_EMAIL_TEST_PIN"
$env:APP_REVIEW_PASSWORD="YOUR_APP_REVIEW_PASSWORD"
node scripts/provision-app-review-account.js
```

Then verify login:

```powershell
$env:APP_REVIEW_PASSWORD="YOUR_APP_REVIEW_PASSWORD"
node scripts/app-store-smoke.js
```

The script creates the account if missing, **resets the password** if it already exists, and grants War Room tier. Deploy latest API first so `/api/subscription/admin/app-review` is live.

### Sign-in instructions for Apple

iOS cold launch opens **Sign in** by default (not Create account). Reviewers enter the demo email/password and tap Sign in.

- Web: https://gatorvaultinsider.com/join/?mode=signin
- iOS app: cold launch → Sign in form (Create account is a separate tab — do not use it for the demo account)

### Reply to App Review (Resolution Center) — August 3, 2026

```
Hello App Review,

Thank you for the feedback on submission 317aee73-09ef-4bda-93a0-885abc8def83 (1.0.12).

Guideline 2.1(a) — Unable to log in:
We fixed the iOS cold-launch path so the app opens Sign in by default (not Create account). The demo account is live on production with War Room full access.

Please:
1. Launch the app (cold start opens the Sign in form).
2. Enter the demo credentials from App Review Information.
3. Tap Sign in — do not use Create account (that email already exists).

Email: [REDACTED]
Password: (same value entered in App Review Information)

Review paths after sign-in:
1. Game Week — /vault/game-week/
2. Film Room — /vault/film-room/
3. FutureCast — /vault/futurecast/
4. Membership & IAP — /vault/membership/
5. Community — /vault/community/ (Report / Block)
6. Privacy & Terms — https://gatorvaultinsider.com/privacy/ and https://gatorvaultinsider.com/terms/

Support: support@gatorvaultinsider.com

Thank you,
Charles Rourk
```

### Reply to App Review (Resolution Center) — July 11, 2026

```
Hello App Review,

Thank you for the feedback on submission 475e2270-8df3-4c10-937a-a06ad88f47bc (1.0 build 11).

Guideline 2.1 — Demo account:
We verified and reprovisioned the demo account on production. Sign-in works with War Room full access.

Email: [REDACTED]
Password: GvAppReview!2026

Please tap Sign in on the join screen (not Create account), then enter the credentials above.

Review paths after sign-in:
1. Game Week — /vault/game-week/
2. Film Room — /vault/film-room/
3. FutureCast — /vault/futurecast/
4. Membership & IAP — /vault/membership/
5. Community — /vault/community/ (Report / Block)
6. Privacy & Terms — https://gatorvaultinsider.com/privacy/ and https://gatorvaultinsider.com/terms/

Support: support@gatorvaultinsider.com

Thank you,
Charles Rourk
```

### Reply to App Review (Resolution Center) — July 9, 2026

```
Hello App Review,

Thank you for the feedback on submission 475e2270 (1.0 build 11).

Guideline 3.1.2(c) — Terms of Use (EULA):
We updated App Store metadata to include functional legal links in the App Description:
- Privacy Policy: https://gatorvaultinsider.com/privacy/
- Terms of Use (EULA): https://gatorvaultinsider.com/terms/

The Privacy Policy URL field in App Information also points to https://gatorvaultinsider.com/privacy/.
In the app, Membership & Account lists each auto-renewable subscription (title, monthly/annual price, billing period) with links to the same Privacy Policy and Terms of Use. A screen recording confirming both metadata and in-app links is attached in App Review Information.

Guideline 2.1 — Demo account:
We reprovisioned the demo account on production. Please use:

Email: [REDACTED]
Password: GvAppReview!2026

Sign in: tap "Sign in" on the join screen (not "Create account"), then enter the credentials above.
The demo account has War Room tier with full access to all features.

Review paths after sign-in:
1. Game Week — /vault/game-week/
2. Film Room — /vault/film-room/
3. FutureCast — /vault/futurecast/
4. Membership & IAP — /vault/membership/
5. Community — /vault/community/ (Report / Block)
6. Privacy & Terms — https://gatorvaultinsider.com/privacy/ and https://gatorvaultinsider.com/terms/

Support: support@gatorvaultinsider.com

Thank you,
Charles Rourk
```

### Reply to App Review (Resolution Center) — earlier template

```
Hello,

We have reprovisioned the demo account on our production server. Please use:

Email: [REDACTED]
Password: GvAppReview!2026

Sign in: tap "Sign in" on the join screen (not "Create account"), then enter the credentials above.
The demo account has War Room tier with full access to all features.

Guideline 2.1 — Gambling:
No. Users cannot place bets or gamble in GatorVault Insider. The Game Zone section displays third-party betting lines and spreads for informational purposes only (similar to a sports news preview). Score predictions and trivia award local Vault Points only — there is no real-money wagering.

Guideline 2.1 — Paid content:
Yes. GatorVault Insider offers optional auto-renewable subscriptions purchased through Apple In-App Purchase:
- Locker Room — $4.99/month (com.gatorvaultinsider.locker.monthly)
- Film Room — $9.99/month (com.gatorvaultinsider.film.monthly)
- War Room — $19.99/month (com.gatorvaultinsider.war.monthly)

End users pay Apple directly via the App Store. The demo account above is pre-provisioned with War Room access so you can review all paid features without purchasing.

Review paths after sign-in:
1. FutureCast — /vault/futurecast/
2. Recruiting — /vault/recruiting/
3. Team — /vault/team/
4. Community — /vault/community/ (Report / Block user on any thread)
5. Membership — /vault/membership/ (do NOT delete demo account)
6. Legal — /privacy/ and /terms/

Support: support@gatorvaultinsider.com

Thank you,
Charles Rourk
```

### Reviewer walkthrough

1. Sign in at `/join` or `/vault/login/`
2. Open **Community** → open any thread → **Report** / **Block user**
3. Open **Membership** → scroll to **Delete account** (do not delete the review account)
4. Privacy `/privacy/` and Terms `/terms/` load without auth

## UGC moderation

Members-only community at `/vault/community/`. Signed-in users can **report** thread OP and replies and **block** other members.

- `POST /api/community/post/:id/flag`
- `POST /api/community/thread/:id/flag`

**Review path:** Vault -> Menu -> Community -> open a thread -> Report / Block user.

## Account deletion

`/vault/membership/#delete-account` — password plus type `DELETE`.

### Notes for reviewer (paste into App Store Connect)

```
GatorVault Insider — demo account has War Room tier (full access until StoreKit live).

SIGN IN: https://gatorvaultinsider.com/join/

REVIEW PATHS
1. FutureCast — /vault/futurecast/
2. Recruiting — /vault/recruiting/
3. Team — /vault/team/
4. Community — /vault/community/ → open thread → Report / Block user
5. Membership — /vault/membership/ (do NOT delete demo account; delete UI at #delete-account)
6. Legal — /privacy/ and /terms/ (no sign-in required)

UGC: Signed-in members can report posts and block users. Reports stored server-side.
Account deletion: password + type DELETE at /vault/membership/#delete-account
Support: support@gatorvaultinsider.com
```

Full listing copy (description, keywords): see `docs/APP_STORE_CONNECT.md`.

## Subscriptions

See `docs/APP_STORE_SUBSCRIPTIONS.md`. StoreKit verification is Step 3b (pending Apple Developer account).
