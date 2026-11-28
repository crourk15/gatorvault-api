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
- Recruiting Portal tab is the January 4–13, 2027 war room (10–12 difference makers, ranked rooms). Names stay off until verified. Approved 1.0.33 still first-paints lock-icon “Portal Closed” until this bake. Live `/api/recruiting/portal` hydrates the prep payload after Render.
- Who’s Moving stays on board intel. Approved 1.0.33 still writes `?tab=movement` and can dump onto the 2028 class war-room until this bake. Live Netlify hydrates `?tab=intel` after deploy.
- Recruiting panel tabs share one command header. Portal no longer stacks under the class-hub hero titles. Live Netlify hydrates after deploy.
- Portal War Room lists the live 2027 commit class and remaining targets (Tranard, flip watch). OT is Hutcheson/Fisher — Hiller is IOL. Portal transfer names stay off. Live Netlify hydrates after deploy.
- Portal Room is a FutureCast tab next to Early Discovery. Recruiting stays the class board. Gap-fillers only when they fill a roster hole. Portal commits land on recruiting with a Portal transfer stamp. Live Netlify hydrates after deploy.

## Whats New (paste)

```
The 2027 recruiting class chart stays on the current class. It no longer snaps back to the old rank and commit count.
```
