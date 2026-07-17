# Membership trial & email (how it works)

## Duplicate accounts

- Exact same email **cannot** register twice while the account exists → HTTP 409 “Sign in instead.”
- Production was already enforcing this.
- If you saw many “new” accounts with the same password, they were almost certainly **different emails**, or **delete → create again** (that used to reset the 30-day clock).

## 30-day trial tracking

- On first signup we store `trialEnd = now + 30 days` on the user record (`users.json` on the API).
- `daysLeft` = ceil(trialEnd − now).
- Login blocks expired unpaid trials (HTTP 402).
- Membership page shows **Free trial: N days left · ends &lt;date&gt;**.
- Build 22+: a **trial ledger** remembers each email’s original `trialEnd`. Delete → re-register keeps that same window (no new free month).

## Email / “activation”

- There is **no activation link**. Accounts work immediately after signup.
- We send a **welcome email** via EmailJS (`onboardingMode: welcome_only`).
- If EmailJS is misconfigured, signup still succeeds; the app may say welcome email was not sent.

## Where fans see the clock

1. Join success copy (days left)
2. Membership & Account → trial status line
