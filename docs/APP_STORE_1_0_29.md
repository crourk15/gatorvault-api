# Submit 1.0.29 (Build 97+) — new train after 1.0.28 accepted

**Why:** Apple accepted **1.0.28** on Sep 21, 2026 (submission `3e6e63db-1028-4ca3-a71a-51584bf05f32`). That train is closed. Charles asked for **1.0.29** so iOS matches the live web: clean NOW, Game Week already there, Baugh 95.

Do **not** upload another 1.0.28. Do **not** start Codemagic until this bump is on `main` and this agent says so.

## iOS

- `MARKETING_VERSION = 1.0.29`
- `CURRENT_PROJECT_VERSION = 97` (Codemagic may auto-bump above ASC latest)

## App Store Connect (you)

1. **Apps → GatorVault → + Version → 1.0.29** (if ASC does not auto-create it)
2. Merge this bump to `main`
3. Start Codemagic **iOS Release Build** on `main`
4. Attach the processed build to **1.0.29** / TestFlight

I will not start Codemagic.

## Ships in this bake

- **Home NOW (iOS):** Game / Visitors / Season on first paint. Last-good so a 30s ticker miss cannot snap back to `#8` class-rank seed. Web already has this; the accepted 1.0.28 binary does not.
- **Game Week:** first-paints the live Ole Miss keys / scout / swing (Maintain Lane Discipline / Cap the Vertical Shots / Establish the Downhill Run Game). No 5-second swap from the Sep 21 seed.
- **Game Week still editable:** last-good + live `/api/schedule`. Home prefetches the board so keys are already there when you open the page.
- **Swing Impact:** player grade, not `72 + list order`. Baugh on Ole Miss is **95**.

Closest to commit and Community speed are **API after Render** — no Codemagic. Live HP stays no-store so Closest is never stuck on a baked list.

Weekly visitor names / predictions stay API after this bake.
