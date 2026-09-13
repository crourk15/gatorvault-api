# Submit 1.0.25 (Build 90+) — Team Week 1 stats

**Why:** Charles called this bake **1.0.25**. Current `project.pbxproj` was **1.0.24** / 89. New upload is a higher `CFBundleShortVersionString`.

**Closed:** 1.0.25 is approved. Codemagic cannot upload another 1.0.25 IPA (`90062` / `90186`). Next train is **1.0.26** (`docs/APP_STORE_1_0_26.md`).

## iOS

- `MARKETING_VERSION = 1.0.25`
- `CURRENT_PROJECT_VERSION = 90` (Codemagic may auto-bump above ASC latest)

## App Store Connect (you)

1. **Apps → GatorVault → + Version → 1.0.25** (if ASC does not auto-create it)
2. Merge this version bump to `main`
3. Run Codemagic **iOS Release Build** on `main`
4. Attach the processed build to **1.0.25** / TestFlight

Do **not** start Codemagic until this bump is on `main`.

## Ships in this bake

Client/UI backlog, including:

- Team roster Stats tab accepts official-box lines — **Philo**, Stockton, Durkin, and anyone who never had a CFBD row. Wilson / Baugh / Graham Week 1 is already live via API on 1.0.23.
- Official box footer on the Stats tab
- Film Room: Review tab off; lands on Breakdowns
- Game Week + Home countdown: next kickoff (not hardcoded FAU)
- Game Week official two-deep cards
- Game Zone live strip + last-whistle final
- Gators Live living room + faster poll
- Remaining Waiting-for-Codemagic rows in `docs/IOS_CODEMAGIC_BACKLOG.md`

**Not this bake:** Home **RIVALRY WEEK** badge (FSU / UGA only). Charles moved that to **1.0.26**.

API/data already live without this bake: Week 1 box on CFBD careers (Wilson, Baugh, Brown, Jones, Graham, …).

## Whats New (paste)

```
Team profiles now show Week 1 stats — including Philo and the rest of the official box. Film Room lands on Breakdowns. Game Week opens the next kickoff. Gators Live living room. Score alerts at kickoff, every score, halftime, and the final.
```
