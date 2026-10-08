# Submit 1.0.32 (Build 101+) — Community Reply

**Why:** Apple approved **1.0.31**. Codemagic cannot upload another 1.0.31 IPA (version train closed). Community Reply was on that closed train. This bump is the next bake.

Do **not** upload another 1.0.31. Do **not** start Codemagic until this bump is on `main`.

## iOS

- `MARKETING_VERSION = 1.0.32`
- `CURRENT_PROJECT_VERSION = 101` (Codemagic may auto-bump above ASC latest)

## App Store Connect (you)

1. **Apps → GatorVault Insider → + Version → 1.0.32** (if Connect does not auto-create it)
2. Merge this bump to `main`
3. Start Codemagic **iOS Release Build** on `main`
4. Confirm the commit line is this 1.0.32 bump, not leftover 1.0.31
5. Attach the processed build to **1.0.32** / TestFlight

I will not start Codemagic.

## Ships in this bake

- **Community:** Reply under the staff post and every comment. Tap Reply and the composer opens on that card (`@Name` when you write someone else). Approved 1.0.31 still only has the thread box at the top.
- Membership: do not paint “Membership service is waking up” when `/api/subscription/status` flakes on iOS. Subscribe stays up. (This missed the approved 1.0.31 cut.)

## Already live (no extra bake)

Apple IAP / Subscribe on approved **1.0.31**. Verify + restore stay API.
