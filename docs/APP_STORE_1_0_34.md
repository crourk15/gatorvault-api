# Submit 1.0.34 (Build 103+) — recruiting hero stays on the live class

**Why:** **1.0.33** is the approved App Store build. TestFlight showed the right recruiting hero. After the App Store install, the old class line can paint back over it. Do not upload another 1.0.33.

Do **not** start Codemagic until this bump is on `main`.

## iOS

- `MARKETING_VERSION = 1.0.34`
- `CURRENT_PROJECT_VERSION = 103` (Codemagic may auto-bump above ASC latest)

## App Store Connect (you)

1. **Apps → GatorVault Insider → + Version → 1.0.34**
2. Merge this bump to `main`
3. Start Codemagic **iOS Release Build** on `main`
4. Confirm the commit line is this 1.0.34 bump, not leftover 1.0.33
5. Attach the processed build to **1.0.34** / TestFlight, then submit

I will not start Codemagic.

## Ships in this bake

- Recruiting hero does not paint the old class line (rank #8, 26 commits, average 89.9) over the live class.
- The app clears its saved web cache on open so that old hero response is not reused. The member stays signed in.

## Whats New (paste)

```
The 2027 recruiting class chart stays on the current class. It no longer snaps back to the old rank and commit count.
```
