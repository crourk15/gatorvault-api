# App Store Connect — Subscription Setup (Step 3a)

Create these **auto-renewable subscriptions** in [App Store Connect](https://appstoreconnect.apple.com) before Step 3b (StoreKit in the iOS app).

## Subscription group

| Field | Value |
|-------|--------|
| Reference name | GatorVault Insider |
| Group ID (internal) | `gatorvault_insider` |

## Products (must match server catalog)

Product IDs are defined in `server/lib/subscription-config.js`.

| Tier | Monthly product ID | Suggested price |
|------|-------------------|-----------------|
| Locker Room | `com.gatorvaultinsider.locker.monthly` | $4.99 |
| Film Room | `com.gatorvaultinsider.film.monthly` | $9.99 |
| War Room | `com.gatorvaultinsider.war.monthly` | $19.99 |

Optional annual products (same tier, lower effective monthly):

| Tier | Annual product ID |
|------|-------------------|
| Locker Room | `com.gatorvaultinsider.locker.annual` |
| Film Room | `com.gatorvaultinsider.film.annual` |
| War Room | `com.gatorvaultinsider.war.annual` |

## App Store Connect checklist

1. Enroll in **Apple Developer Program** ($99/year)
2. Create the app record (Bundle ID: `com.gatorvaultinsider.app`)
3. **Subscriptions** → create group → add 6 products above
4. Set **Subscription Duration** (1 month / 1 year)
5. Add localized display names matching GatorVault tier names
6. Link **Privacy Policy URL**: `https://gatorvaultinsider.com/privacy/`
7. Complete **App Privacy** questionnaire in Connect
8. Configure **App Store Server Notifications** URL (Step 3b):
   `https://gatorvault-api.onrender.com/api/subscription/apple/notifications`

## Server env (Step 3b — not required yet)

```env
APPLE_IAP_VERIFICATION_ENABLED=false
# Step 3b adds: App Store Connect API key, issuer ID, bundle ID, etc.
```

## Manual grant (until IAP is live)

For testing paid access without Apple verification:

```http
POST /api/subscription/admin/grant
Content-Type: application/json

{
  "pin": "YOUR_EMAIL_TEST_PIN",
  "email": "user@example.com",
  "tier": "film"
}
```

Uses `EMAIL_TEST_PIN` from Render env (same as email test tools).

## Finish IAP setup in Connect (July 2026 resubmit)

**Status:** Production `70f1483` live. Demo account reprovisioned. Age Rating Gambling=Yes done. Group **GatorVault Insider** (22217632). War monthly/annual created; **4 products + all screenshots + Submit for Review** still required.

| Product ID | Display name | Duration | USD |
|------------|--------------|----------|-----|
| `com.gatorvaultinsider.war.monthly` | War Room Monthly | 1 month | $19.99 |
| `com.gatorvaultinsider.war.annual` | War Room Annual | 1 year | $191.88 (~$191.99 tier) |
| `com.gatorvaultinsider.film.monthly` | Film Room Monthly | 1 month | $9.99 |
| `com.gatorvaultinsider.film.annual` | Film Room Annual | 1 year | $95.88 (~$95.99 tier) |
| `com.gatorvaultinsider.locker.monthly` | Locker Room Monthly | 1 month | $4.99 |
| `com.gatorvaultinsider.locker.annual` | Locker Room Annual | 1 year | $47.88 (~$47.99 tier) |

**Levels:** War=1, Film=2, Locker=3. Review screenshot for each: `docs/app-store-screenshots/05-membership.png`.

Then version 1.0: attach **Build 11**, paste notes from `docs/app-store-screenshots/APP_STORE_CONNECT_PASTE.txt`, attach deletion video, Resolution Center reply, **Add for Review**.

## API endpoints (live after deploy)

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/subscription/catalog` | Public |
| GET | `/api/subscription/status` | Bearer session |
| POST | `/api/subscription/apple/verify` | Bearer (503 until 3b) |
| POST | `/api/subscription/admin/grant` | Admin PIN |

Web membership page: `/vault/membership/`
