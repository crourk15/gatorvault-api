# App Store 1.0.5 — Build 22

**Status:** Ready after Build 21 TestFlight.

**Version:** marketing 1.0.5 · build 22  
**Bundle:** `com.gatorvaultinsider.app`

## In this binary (on top of 21)

1. **Trial hardening** — Same email cannot mint a fresh 30-day trial after delete/re-register; vault gate sends expired unpaid sessions to Membership; Join shows days left / duplicate-email → Sign in.
2. **Email clarity** — Welcome email only (no activation link). Trial is tracked server-side per email via `trialEnd` + trial ledger.
3. Legacy `bridge-session` disabled unless `AUTH_BRIDGE_SECRET` is set.

## Codemagic

Start **iOS Release Build** on `main` after Build 21 is on TestFlight.
