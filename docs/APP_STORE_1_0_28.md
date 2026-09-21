# Submit 1.0.28 (Build 94) — close 1.0.28 train

**Why:** Build 93 is on TestFlight with the old one-line Home NOW. This bake is the three-pillar NOW (Game / Visitors or News / Season) plus the rest of the 1.0.28 client stack.

New uploads must use a higher marketing version than the approved **1.0.27**. 1.0.28 already exists in App Store Connect.

## iOS
- `MARKETING_VERSION = 1.0.28`
- `CURRENT_PROJECT_VERSION = 94` (Codemagic may auto-bump above ASC latest)

## App Store Connect (you)
1. **1.0.28** already exists from build 93.
2. Merge this bump to `main`.
3. Start Codemagic **iOS Release Build** on `main` only after this agent says the bump is on `main`.
4. Attach the processed build to **1.0.28** / TestFlight.
Do **not** start Codemagic on 1.0.27. That train is closed.

## Ships in this bake
- Home NOW: three bold pillars — Game, Visitors (or News if a Florida commit this week), Season. ABC lives on Game only.
- Home NOW: last-week Campbell gameday lines stay off
- Game Week Swing Impact is the player grade, not 72 + list order (Baugh first on Ole Miss is **95**)
- My Alerts elite
- Gators Live snap
- Community locker + Game talk

Weekly schedule / predictions / visitor names stay API. Do not bake those.
