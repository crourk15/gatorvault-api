# Membership trial & email (how it works)

## Duplicate accounts

- Exact same email **cannot** register twice while the account exists → HTTP 409 “Sign in instead.”
- Production was already enforcing this.
- If you saw many “new” accounts with the same password, they were almost certainly **different emails**, or **delete → create again** (that used to reset the 30-day clock).

## 30-day trial tracking

- On first signup we store `trialEnd = now + 30 days` on the user record (`users.json` on the API; production uses persistent disk via `GV_USERS_PATH` — see `docs/AUTH_ACCOUNT_PERSISTENCE.md`).
- `daysLeft` = ceil(trialEnd − now).
- Expired unpaid trials still get a **session** so they can open Membership / restore / subscribe in the iOS app. Vault content stays gated (`accessActive: false`).
- Membership page shows **Free trial: N days left · ends &lt;date&gt;**.
- Build 22+: a **trial ledger** remembers each email’s original `trialEnd`. Delete → re-register keeps that same window (no new free month).
- Paid access is **time-bounded** (`subscription.expiresAt`). Canceling Apple auto-renew keeps access until the period ends; `EXPIRED` / refund / revoke remove access.
- Paid conversion: **Apple IAP in the iOS app**, plus **web Stripe checkout** when configured (browser only). Same account unlocks both surfaces.

## Email / onboarding drip

- There is **no activation link**. Accounts work immediately after signup.
- **Primary path (recommended):** **Resend** raw HTML — see `docs/EMAIL_RESEND_SETUP.md`. No EmailJS template Save required.
- **Fallback:** EmailJS (`onboardingMode: drip`) when Resend/SendGrid/SMTP are not configured.
- **Day 0 welcome** sends on `/api/register`.
- **Server drip** (hourly in-process + Render cron `gatorvault-api-onboarding-drip`):
  - Day **1** — playbook / activate
  - Day **3** — Recruiting + FutureCast
  - Day **7** — trial checklist
  - Day **25** — trial ending → Membership CTA
- **Trial-clock convert emails** (based on `trialEnd`, not signup day):
  - **5 days left**
  - **1 day left**
- Paid members are skipped.
- Kill switch: `ONBOARDING_DRIP_DISABLED=true`.
- Optional Beehiiv enroll on register when `BEEHIIV_*` env is set (does not replace the server drip).
- If no provider can send, signup still succeeds; the app may say welcome email was not sent.

## Paid membership confirmation

- Sent **once** after the first successful Apple IAP verify/restore (or admin grant / ASSN `SUBSCRIBED` / `OFFER_REDEEMED`).
- Not sent on every `DID_RENEW`.
- Idempotency flag on the user: `paidConfirmationSentAt`.
- Same Resend-first `deliverEmail` path as onboarding.

## Weekly fan digest — OFF by default

- Disabled so members are not flooded. Requires explicit `FAN_DIGEST_ENABLED=true` to send.
- Render cron removed from blueprint. Prefer keeping this off.
- Password reset: `POST /api/auth/forgot-password` + `POST /api/auth/reset-password` (signed Resend link, 24 hours, `/reset/` so iOS does not steal it). Admin Hub → Members can grant a complimentary account and email a create-password link.
- Web checkout: see `docs/STRIPE_WEB_CHECKOUT.md`.

### EmailJS template (optional fallback)

If you stay on EmailJS, paste `server/emailjs-welcome-template.html` into `template_okh1hj8`:

- Subject: `{{email_subject}}`
- Body uses `{{{body_html}}}`

If EmailJS **Save** is broken (their outage), use Resend instead — do not block the drip on their dashboard.

## Where fans see the clock

1. Join success copy (days left)
2. Membership & Account → trial status line
3. Trial convert emails → Membership CTA (`/vault/membership/`)
