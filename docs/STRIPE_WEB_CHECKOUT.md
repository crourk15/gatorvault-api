# Stripe web checkout (browser only)

Web membership checkout via Stripe. **Never shown inside the iOS app** (Apple IAP stays the only in-app purchase path).

## Status

- Code is live when `STRIPE_SECRET_KEY` + price IDs are set on Render.
- Until then, `webCheckoutEnabled` stays `false`.

## Fast path (recommended)

Paste these into chat (or `server/.env`) and the agent/script does the rest:

1. **Stripe Secret Key** — Stripe Dashboard → Developers → API keys → Secret key (`sk_live_...` or `sk_test_...` for dry run)
2. **Render API Key** — Render → Account Settings → API Keys (`rnd_...`)

Then run from `server/`:

```bash
STRIPE_SECRET_KEY=sk_live_... RENDER_API_KEY=rnd_... \
  node scripts/setup-stripe-web-checkout.js --deploy
```

That script will:

- Create 3 Products + 6 recurring Prices (Locker/Film/War × monthly/annual)
- Register webhook `https://gatorvault-api.onrender.com/api/subscription/stripe/webhook`
- Create a Customer Portal configuration
- Push env vars to Render `gatorvault-api` and redeploy (`--deploy`)

Re-run is safe (reuses products/prices by metadata / lookup_key).

If the webhook already exists and Render is missing `STRIPE_WEBHOOK_SECRET`:

```bash
STRIPE_SECRET_KEY=sk_live_... RENDER_API_KEY=rnd_... \
  node scripts/setup-stripe-web-checkout.js --rotate-webhook --deploy
```

## Manual path (Dashboard)

1. Create **6 recurring Prices** (USD):
   - Locker monthly $4.99 / annual $47.88
   - Film monthly $9.99 / annual $95.88
   - War monthly $19.99 / annual $191.88
2. Render → `gatorvault-api` → Environment:

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

3. Webhook endpoint + events:

`https://gatorvault-api.onrender.com/api/subscription/stripe/webhook`

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

4. Enable Customer Portal (Settings → Billing → Customer portal).
5. Redeploy the API.

## Verify

```bash
curl -sS https://gatorvault-api.onrender.com/api/subscription/health | jq '.webCheckoutEnabled'
curl -sS https://gatorvault-api.onrender.com/api/version | jq '.features.webCheckout'
```

On web `/vault/membership/` (not iOS): signed-in users see **Web monthly / Web annual** buttons.

## App Store note

iOS continues to use Apple IAP only. Stripe CTAs are gated with `!isNativeApp()`.
