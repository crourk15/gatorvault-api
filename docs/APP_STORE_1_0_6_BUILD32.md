# Submit 1.0.6 (Build 32) — App Store / TestFlight

**Elite platform cut** after shell trust (29–31), Admin Hub daily ops, and never-late recruiting intel.

## What’s in Build 32

1. **Home brand hero** — full-bleed **GatorVault** H1; slogan demoted; no inset command card
2. **Product voice** — vault UI no longer says “Command Center” on Team / Recruiting / FutureCast / NIL heroes
3. **Recruiting narrative** — hero frame is “Who Florida is chasing,” not a war-room dump title
4. **Never-late stack** (already on API) — Unresolved Predictions → teaser identity → Lab radar (Cyion / Alderman path)

## Deferred (not blocking 32)

- Full design-system CSS collapse (`*-elite.css` layers)
- Sidebar emoji chrome cleanup
- Admin Hub deep iframe rewrite
- Autoposter G1–G4 operator sign-off checklist

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
