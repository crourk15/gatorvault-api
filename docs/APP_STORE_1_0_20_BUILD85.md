# Submit 1.0.20 (Build 85+) — new train after 1.0.19 approved

**Why:** App Store approved **1.0.19**. Pre-release train is closed; new uploads must use a higher `CFBundleShortVersionString`.

## iOS

- `MARKETING_VERSION = 1.0.20`
- `CURRENT_PROJECT_VERSION = 85` (Codemagic may auto-bump above ASC latest)

## App Store Connect (you)

1. **Apps → GatorVault → + Version → 1.0.20** (if ASC does not auto-create it)
2. Merge this version bump to `main`
3. Run Codemagic **iOS Release Build** on `main`
4. Attach the processed build to **1.0.20** / TestFlight

## Ships in this bake

Client/UI backlog from `docs/IOS_CODEMAGIC_BACKLOG.md` not yet in the 1.0.19 binary, including:

- Why we chase: prefer live API `whyWeChase` (Admin-editable elite copy anytime after this bake)
- Chase cards: Expected visit line + clearer On3 lead stamps/labels
- Closest / Chase board-truth client gates (no fake Florida locks from crumb RPM)
- Game Week: Expected visitors panel + live `/api/schedule` path
- Articles: Authors + Tags filters; no duplicate Related rail
- Home NOW live commit counts; Alerts Board Intel UV + recent-window copy
- Team depth chart live from camp API
- Remaining Community / Footprint / signup-channel rows still waiting from the closed 1.0.19 train

API/data Why we chase handwrites remain live on Render without this bake — this bake makes the binary prefer that field.

## Whats New (paste)

```
Priority Chase Why we chase is live from GatorVault — clearer, staff-led reasons that update without waiting on an app rebuild. Expected visits show on chase cards. Game Week Expected visitors + live schedule polish. More accurate On3 leads on Chase/Closest, Articles Authors & Tags, Home NOW commit counts, Community posting, and Team depth chart updates from camp.
```
