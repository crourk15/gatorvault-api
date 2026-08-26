# Submit 1.0.21 (Build 86+) — new train after 1.0.20 approved

**Why:** App Store Connect closed the **1.0.20** pre-release train (`90186` / `90062`). New uploads must use a higher `CFBundleShortVersionString` than the previously approved **1.0.20**.

## iOS

- `MARKETING_VERSION = 1.0.21`
- `CURRENT_PROJECT_VERSION = 86` (Codemagic may auto-bump above ASC latest)

## App Store Connect (you)

1. **Apps → GatorVault → + Version → 1.0.21** (if ASC does not auto-create it)
2. Merge this version bump to `main`
3. Re-run Codemagic **iOS Release Build** on `main`
4. Attach the processed build to **1.0.21** / TestFlight

## Ships in this bake

Client/UI backlog that was queued for the closed 1.0.20 train, including:

- Home NOW: kill Tranard Auburn seed stone; 3-week freshness; no mid-cut article blurbs; live commit counts
- Why we chase: prefer live API `whyWeChase` (Admin-editable elite copy anytime after this bake)
- Chase cards: Expected visit line + clearer On3 lead stamps/labels
- Closest / Chase board-truth client gates
- Game Week: Expected visitors panel + live `/api/schedule` path
- Articles: Authors + Tags filters; no duplicate Related rail
- Community: Edit + Delete on own posts (merge #578 before bake if still open)
- Remaining Community / Footprint / signup-channel / Team depth chart rows from the backlog

API/data fixes remain live on Render without this bake.

## Whats New (paste)

```
Home NOW is sharper — no stale visit stones (including Tranard Auburn), only recent Florida process. Priority Chase Why we chase is live from GatorVault. Expected visits on chase cards. Game Week Expected visitors + live schedule polish. Community Edit/Delete on your posts. More accurate On3 leads on Chase/Closest, Articles Authors & Tags, and Team depth chart updates from camp.
```
