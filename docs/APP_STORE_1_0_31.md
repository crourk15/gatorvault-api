# Submit 1.0.31 (Build 99+) — Apple Subscribe buttons after IAP flip

**Why:** Production Apple IAP verify is on (`iosPurchaseReady: true`). The **1.0.30** Membership screen still hides Subscribe until the live catalog flag arrives. After a fresh install that line stayed **Billing is temporarily unavailable**, so the current binary cannot take money.

Do **not** upload another 1.0.30. Do **not** start Codemagic until this bump is on `main`.

## iOS

- `MARKETING_VERSION = 1.0.31`
- `CURRENT_PROJECT_VERSION = 99` (Codemagic may auto-bump above ASC latest)

## App Store Connect (you)

1. **Apps → GatorVault Insider → + Version → 1.0.31** (if Connect does not auto-create it)
2. Merge this bump to `main`
3. Start Codemagic **iOS Release Build** on `main`
4. Attach the processed build to **1.0.31** / TestFlight
5. Buy Locker Room Monthly on device

I will not start Codemagic.

## Ships in this bake

- **Membership:** native Subscribe uses StoreKit readiness, not the catalog `iosPurchaseReady` kill switch.
- Hardcoded Apple product IDs (Locker / Film / War) so the cards still render if `/api/subscription/catalog` never lands.
- Probe StoreKit on every Membership load, even when the catalog fetch fails.
- Web still says open the iOS app (Stripe stays off).

## Already live (no extra bake)

Apple IAP env on Render, App Store Server Notifications, six Approved products. Verify + restore stay API.
