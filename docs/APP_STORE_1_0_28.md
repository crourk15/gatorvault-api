# App Store 1.0.28 (Build 95) — close 1.0.28 train

Build 94 is on TestFlight with three-pillar NOW code, but first paint still fell back to the one-line `Game — Ole Miss in the Swamp · ABC` when `nowWeek` was empty (SWR cache without `nowWeek`). This bake seeds local Game / Visitors / Season on first paint and skips ticker SWR.

New uploads must use a higher marketing version than the approved **1.0.27**. 1.0.28 already exists in App Store Connect.

## iOS
- `MARKETING_VERSION = 1.0.28`
- `CURRENT_PROJECT_VERSION = 95` (Codemagic may auto-bump above ASC latest)

## App Store Connect (you)
1. **1.0.28** already exists from build 93.
2. Merge this bump to `main`.
3. Start Codemagic **iOS Release Build** on `main` only after this agent says the bump is on `main`.
4. Attach the processed build to **1.0.28** / TestFlight.
Do **not** start Codemagic on 1.0.27. That train is closed.

## Ships in this bake
- Home NOW: local weekly pillars on first paint (Game / Visitors ticking first+last / Season). Never the single Game ABC line.
- Home NOW: skip SWR for `/api/recruiting/hub/ticker` so an old items-only cache cannot hide `nowWeek`.
- Home NOW three bold pillars (Game / Visitors or News / Season) with names ticking under Visitors
- Home NOW drops last-week Campbell gameday/visit lines
- Game Week Swing Impact is the player grade, not 72 + list order (Baugh first on Ole Miss is **95**)
- My Alerts elite
- Gators Live snap
- Community locker + Game talk
Weekly schedule / predictions / visitor names stay API. Do not bake those.
