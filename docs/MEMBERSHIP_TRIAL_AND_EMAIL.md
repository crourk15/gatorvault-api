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
- Paid conversion is **Apple IAP in the iOS app** (no web checkout yet). Same account unlocks web after verify.

## Email / “activation”

- There is **no activation link**. Accounts work immediately after signup.
- We send a **welcome email** via EmailJS (`onboardingMode: welcome_only`) describing the **free trial** (not App Store auto-renew).
- If EmailJS is misconfigured, signup still succeeds; the app may say welcome email was not sent.

## Where fans see the clock

1. Join success copy (days left)
2. Membership & Account → trial status line
