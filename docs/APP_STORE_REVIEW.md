# App Store Review Notes (GatorVault Insider)

Use in **App Store Connect -> App Review Information -> Notes**. Full checklist: `docs/APP_STORE_METADATA.md`.

## Support

- Email: support@gatorvaultinsider.com
- Privacy: https://gatorvaultinsider.com/privacy/
- Terms: https://gatorvaultinsider.com/terms/

## Demo account (App Review)

Provision a reviewer account before submission. Enter credentials **only** in App Store Connect (not in git):

- Email: appreview@gatorvaultinsider.com (create via `/join` or operator grant)
- Password: App Store Connect secure field
- Tier: Film Room or War Room recommended

Until StoreKit is live (Step 3b), grant paid tier with `POST /api/subscription/admin/grant` and `EMAIL_TEST_PIN` if needed.

## UGC moderation

Members-only community at `/vault/community/`. Signed-in users can **report** thread OP and replies and **block** other members.

- `POST /api/community/post/:id/flag`
- `POST /api/community/thread/:id/flag`

**Review path:** Vault -> Menu -> Community -> open a thread -> Report / Block user.

## Account deletion

`/vault/membership/#delete-account` — password plus type `DELETE`.

## Subscriptions

See `docs/APP_STORE_SUBSCRIPTIONS.md`. StoreKit verification is Step 3b (pending Apple Developer account).
