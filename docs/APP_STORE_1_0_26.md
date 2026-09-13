# Submit 1.0.26 — Rivalry Week badge

**Why:** Charles moved the Home countdown **RIVALRY WEEK** badge off the 1.0.25 stats train. Next client bake that carries the badge is **1.0.26**.

Do **not** start Codemagic until Charles says start.

## What this bake fixes

Home countdown `gameDayBadge` is bundled. Current App Store still treats Auburn as rivalry. After this bake:

- **RIVALRY WEEK** = FSU + UGA only (`RIVAL_OPPONENT_IDS`)
- Auburn (and Miami) stay **GAME WEEK**
- Web already correct after #673

Weekly schedule predictions / Game Week intel stay API. Do not bake those.

## iOS (when Charles starts it)

- Bump `MARKETING_VERSION` to `1.0.26` on `main` first
- `CURRENT_PROJECT_VERSION` above the last 1.0.25 build (Codemagic may auto-bump)
- App Store Connect: **+ Version → 1.0.26**
- Codemagic **ios-release** on `main`

See `docs/IOS_CODEMAGIC_BACKLOG.md` Waiting row (2026-09-13).
