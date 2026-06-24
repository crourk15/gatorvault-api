# App Store Review Notes (GatorVault Insider)

Use in **App Store Connect -> App Review Information -> Notes**. Full checklist: `docs/APP_STORE_METADATA.md`.

## Support

- Email: support@gatorvaultinsider.com
- Privacy: https://gatorvaultinsider.com/privacy/
- Terms: https://gatorvaultinsider.com/terms/

## Demo account (App Review)

Enter credentials **only** in App Store Connect (not in git):

- Email: `appreview@gatorvaultinsider.com`
- Password: App Store Connect secure field
- Tier: War Room (granted via admin API until StoreKit live)

### Provision on production

```bash
SUBSCRIPTION_ADMIN_PIN=... APP_REVIEW_PASSWORD=... node scripts/provision-app-review-account.js
```

The script registers the account if missing, grants War Room tier, and prints the email only. Store the password in App Store Connect.

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

## Subscriptions

See `docs/APP_STORE_SUBSCRIPTIONS.md`. StoreKit verification is Step 3b (pending Apple Developer account).
