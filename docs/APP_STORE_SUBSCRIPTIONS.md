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

## API endpoints (live after deploy)

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/subscription/catalog` | Public |
| GET | `/api/subscription/status` | Bearer session |
| POST | `/api/subscription/apple/verify` | Bearer (503 until 3b) |
| POST | `/api/subscription/admin/grant` | Admin PIN |

Web membership page: `/vault/membership/`
