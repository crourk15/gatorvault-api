# Elite final platform build (audit → ship)

One consolidated build after a full inside-out audit.

## Shipped in this build

### Billing / email (P0–P1)
- Stripe unpaid/canceled entitlement logic fixed (no forever-paid on failed invoices)
- Password reset responses no longer leak account existence
- Trial convert emails catch up if the exact day is missed
- Membership copy aligns with web Stripe + Apple IAP
- Support email unified with Resend/EmailJS reply-to
- Public catalog hides War Room unless the member is already on War

### Client / routes (P0–P1)
- Annual marketing price display: `$/mo billed annually` (not wrong `/year`)
- Recruiting deep links use `?tab=` (native-safe)
- VaultShell menu button has React `onClick` fallback
- Blank redirect shells replaced with status text (`/vault/login`, `/portal`, `/depth-chart`)
- `/vault/film/` alias → Film Room
- Guest membership join links use native navigation URLs

### Ops / blueprint
- `render.yaml` web service: `MONITORING_CRON_SECRET`, `RESEND_*`, `FILM_ROOM_DATA_DIR`, `STRIPE_WEB_CHECKOUT_ENABLED`
- `/api/version` `uiBuild` tracks deploy commit

### Product honesty
- Film Room empty/home copy no longer overpromises weekly stubs
- GNL shows “catching up” when still on seed/cached paint
- Depth chart already labeled Spring projections (unchanged)

## Intentionally not in this build
- Weekly fan digest stays **OFF** (no email flood)
- Promo blast kit waits for Apple seller → GatorVault Media, LLC
- Full live depth-chart ingest (static Spring chart remains labeled)
- App Store Server Notifications Connect click-through (ops — see below)

## Charles — one ops step left
App Store Connect → App → App Information → **App Store Server Notifications V2**  
Production URL:

`https://gatorvault-api.onrender.com/api/subscription/apple/notifications`

Send a test notification; `/api/subscription/health` should show `notifications.recentCount > 0`.

Also rotate Stripe + Render keys that were pasted in chat.
