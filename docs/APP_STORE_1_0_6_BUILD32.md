# Submit 1.0.6 (Build 32) — App Store / TestFlight

> **Superseded for upload:** ASC closed the 1.0.6 train after approval (`90186` / `90062`). Next ship: **[1.0.7 Build 33](./APP_STORE_1_0_7_BUILD33.md)**. Do not re-upload 1.0.6.

**Elite platform cut** after shell trust (29–31), Admin Hub daily ops, and never-late recruiting intel.

## What’s in Build 32

1. **Home brand hero** — full-bleed **GatorVault** H1; slogan demoted; no inset command card
2. **Product voice** — vault UI no longer says “Command Center” on Team / Recruiting / FutureCast / NIL heroes
3. **Recruiting narrative** — hero + hub sections in fan voice (“Who Florida is chasing,” “Who’s moving,” “Biggest battles”)
4. **Never-late stack** (already on API) — Unresolved Predictions → teaser identity → Lab radar (Cyion / Alderman path)
5. **Brand typography** — Oswald + Source Sans 3 (Inter removed from vault tokens / wordmark)
6. **Nav chrome** — sidebar + menu use SVG icons (no emoji IDs)
7. **Intel depth** — On3 403 keeps last-good RPM; board pos upgrades ATH/TBD placeholders
8. **Admin Hub** — embed panels labeled legacy with in-shell daily path first + load failure banner

## Remaining before calling Build 32 “true elite”

- Autoposter: human operator sign-off name/date + Render flag confirm (see `ELITE_RECRUITING_INTEL_OPERATOR_SPEC.md`)
- Optional: full Admin Roster/Board iframe rewrite (Alerts + Monitoring Summaries are now in-shell)
- Optional: deeper CSS layer merge beyond dead-file + duplicate import cleanup
- `npm run proof:mobile:deploy` after merge — required before claiming ready

## iOS

- `MARKETING_VERSION = 1.0.6`
- `CURRENT_PROJECT_VERSION = 32`
- Codemagic: `ios-release` on `main`

## Start Codemagic

1. https://codemagic.io → **gatorvault-api**
2. Workflow **iOS Release Build** (`ios-release`)
3. Branch **`main`**
4. **Start new build**

## TestFlight / mobile smoke

1. Home first fold: **GatorVault** brand hero (not slogan-as-H1); no “Command Center” copy
2. Team hero: **Florida Football**
3. Recruiting hero: **Florida Recruiting** / “Who Florida is chasing”
4. FutureCast / NIL heroes: no “Command Center” eyebrow
5. Menu open/close on Home + Recruiting + Team
6. Prefer full `npm run proof:mobile:deploy` before claiming ready

## Whats New (short)

GatorVault Home brand hero, cleaner product voice across Team/Recruiting/FutureCast, and faster recruiting intel when beat teasers drop.
