# App Store Resubmission — What Charles Does

Apple rejected build **1.0 (8)**. Account deletion is in the app; you must **record a video** and **resubmit**.

## Your 4 steps (~30 min)

### 1. Record on iPhone/iPad
1. Sign in with a **throwaway test account** (NOT appreview@gatorvaultinsider.com)
2. Menu → **Membership & Account**
3. **Delete account** (red section, right below tier status)
4. Password + type **DELETE** → confirm
5. Show welcome screen; sign-in fails

### 2. App Store Connect → App Review Information → Notes
Paste:
```
Account deletion: Menu → Membership & Account → Delete account (password + type DELETE).
Permanent deletion — not deactivation.

Demo account (do NOT delete): appreview@gatorvaultinsider.com
Screen recording attached.

No gambling. Paid tiers via Apple IAP only.
```
Attach the screen recording.

### 3. Reply in Resolution Center
```
Account deletion is in-app: Menu → Membership & Account → Delete account.
Screen recording attached in App Review Information.
No gambling. Payments via Apple IAP only.
Charles Rourk
```

### 4. Submit build 9+ with latest code
```bash
cd client && npm run build:mobile && npx cap sync ios
```
Archive in Xcode or Codemagic, submit to review.

## Verify
```bash
node scripts/test-account-delete.js
APP_REVIEW_PASSWORD=... npm run smoke:app-store
```

See also: docs/APP_STORE_REVIEW.md
