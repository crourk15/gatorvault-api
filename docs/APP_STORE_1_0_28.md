# Submit 1.0.28 (Build 93+) — closed 1.0.27 train

**Why:** 1.0.27 shipped Matchup Edge only. This bake is the elite client stack Charles asked for: Swing Impact, My Alerts, Home NOW, Gators Live, Community locker.

New uploads must use a higher marketing version than the approved **1.0.27**.

## iOS

- `MARKETING_VERSION = 1.0.28`
- `CURRENT_PROJECT_VERSION = 93` (Codemagic may auto-bump above ASC latest)

## App Store Connect (you)

1. **Apps → GatorVault → + Version → 1.0.28** (if ASC does not auto-create it)
2. Merge this version bump to `main`
3. Start Codemagic **iOS Release Build** on `main` only after this agent says the bump is on `main`
4. Attach the processed build to **1.0.28** / TestFlight

Do **not** start Codemagic on 1.0.27. That train is closed.

## Ships in this bake

- Game Week Swing Impact is the player grade, not `72 + list order` (Baugh first on Ole Miss is **95**, the offense engine — not the floor)
- My Alerts elite: delivery health, honest On/Off, visit frequency only when email is on
- Home NOW: this week's game + named process, not frozen class metrics
- Gators Live: 2s live poll, local clock tick, wake refetch
- Community locker + Game talk so Saturday comments stay findable
- Queued 1.0.27 leftover client UI that was not in the Matchup Edge IPA (Rivalry Week badge, Film Room seed, ...)

Weekly schedule TV / predictions / visitor names stay API. Do not bake those.

## Whats New (paste)

```
Swing Impact is the player, not the list. Game Week, Live, Alerts, Home NOW, and Community locker.
```
