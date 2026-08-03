# App Store Resolution — August 3, 2026 (Submission 317aee73)

Apple rejected **1.0.12 (86)** on iPhone 17 Pro Max (iOS 26.6): **Guideline 2.1(a) — unable to log in**.

---

## Root cause

Demo credentials were valid on production (`/api/login` → War Room).

iOS cold launch still sent first install to **Create account** (`/join/?mode=signup`) when no remembered email. App Store Connect notes said the app opens **Sign in** by default. Reviewers pasting demo creds into Create account looked like a broken login.

## Fix (this PR)

- Native cold start → always `/join/?mode=signin&next=/vault/`
- Join page + guest nav on native → Sign in first
- ASC paste notes updated with explicit cold-launch Sign in steps

Create account remains available as a tab for new members.

## Before resubmit (Charles)

1. Merge this PR → Netlify picks up join/native boot changes (bundled iOS shell also needs a new Codemagic binary).
2. Trigger Codemagic iOS build (new build number after 86).
3. Confirm demo login still works:
   ```powershell
   $env:APP_REVIEW_PASSWORD="(same as App Store Connect)"
   npm run smoke:app-store
   ```
   Optional reprovision if password drifted:
   ```powershell
   $env:SUBSCRIPTION_ADMIN_PIN="(Render admin pin)"
   $env:APP_REVIEW_PASSWORD="(same as App Store Connect)"
   npm run provision:app-review
   ```
4. App Store Connect → App Review Information → paste Notes from `docs/app-store-screenshots/APP_STORE_CONNECT_PASTE.txt`
5. Resolution Center → paste reply below
6. Submit new binary

---

## Resolution Center reply (paste)

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
