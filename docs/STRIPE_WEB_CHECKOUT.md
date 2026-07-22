# Stripe web checkout (browser only)

Web membership checkout via Stripe. **Never shown inside the iOS app** (Apple IAP stays the only in-app purchase path).

## Status

- Code is live when `STRIPE_SECRET_KEY` + price IDs are set.
- Until then, `webCheckoutEnabled` stays `false` and membership UI keeps the App Store path.

## Charles setup (one-time)

1. Create a Stripe account (or use existing).
2. Create **6 recurring Prices** (USD) matching catalog:
   - Locker monthly $4.99 / annual $47.88
   - Film monthly $9.99 / annual $95.88
   - War monthly $19.99 / annual $191.88
3. In Render → `gatorvault-api` → Environment, set:

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_WEB_CHECKOUT_ENABLED=true
STRIPE_PRICE_LOCKER_MONTHLY=price_...
STRIPE_PRICE_LOCKER_ANNUAL=price_...
STRIPE_PRICE_FILM_MONTHLY=price_...
STRIPE_PRICE_FILM_ANNUAL=price_...
STRIPE_PRICE_WAR_MONTHLY=price_...
STRIPE_PRICE_WAR_ANNUAL=price_...
```

4. Stripe Dashboard → Developers → Webhooks → Add endpoint:

`https://gatorvault-api.onrender.com/api/subscription/stripe/webhook`

Events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

5. Enable Customer Portal (Settings → Billing → Customer portal) so paid web members can manage/cancel.

6. Redeploy or restart the API so env vars load.

## Verify

```bash
curl -sS https://gatorvault-api.onrender.com/api/subscription/health | jq '.webCheckoutEnabled'
curl -sS https://gatorvault-api.onrender.com/api/version | jq '.features.webCheckout'
```

On web `/vault/membership/` (not iOS): signed-in users see **Web monthly / Web annual** buttons.

## App Store note

iOS continues to use Apple IAP only. Stripe CTAs are gated with `!isNativeApp()`.
