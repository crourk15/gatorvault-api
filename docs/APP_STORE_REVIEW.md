# App Store Review Notes (GatorVault Insider)

**Full Connect copy (description, keywords, screenshots):** `docs/APP_STORE_CONNECT.md`  
**Metadata checklist:** `docs/APP_STORE_METADATA.md`

## Support

- Email: support@gatorvaultinsider.com
- Privacy: https://gatorvaultinsider.com/privacy/
- Terms: https://gatorvaultinsider.com/terms/

## Demo account (App Review)

Enter credentials **only** in App Store Connect (not in git):

- Email: `appreview@gatorvaultinsider.com`
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

Reviewers must tap **Sign in** (not Create account) on the join screen:

- Web: https://gatorvaultinsider.com/join/?mode=signin
- iOS app: Menu → Sign in (or Join → Sign in tab)

### Reply to App Review (Resolution Center)

```
Hello,

We have reprovisioned the demo account on our production server. Please use:

Email: appreview@gatorvaultinsider.com
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
