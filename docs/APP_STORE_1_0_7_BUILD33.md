# Submit 1.0.7 (Build 33) — App Store / TestFlight

**Why this version:** App Store Connect closed the **1.0.6** pre-release train after approval (`90186` / `90062`). New uploads must use a higher `CFBundleShortVersionString`.

## iOS

- `MARKETING_VERSION = 1.0.7`
- `CURRENT_PROJECT_VERSION = 33`
- Codemagic: `ios-release` on `main`

## What's in this cut

Same elite platform stack as the Build 32 cut (Home brand hero, recruiting voice, never-late intel, Admin Hub daily path, prod autoposter sign-off) — shipping under a new marketing train because 1.0.6 is locked.

## Mobile deploy proof (local)

**Status: PASS** — `npm run proof:mobile:deploy` on 2026-07-20

- Build ID: `29f559078171-IotI0KRi` (commit `29f559078171`)
- All section checklist rows PASS (Roster → Below NSD rollup + NIL/Game Zone layout)
- Menu open/close PASS on every required vault route
- Cold-load recordings: Home, Recruiting, Team
- `verify:mobile:full` — **3 consecutive passes** (18 routes)

Artifacts (local / agent): `proof/mobile-deploy-proof/`

After this merges and Netlify deploys, run:

```bash
npm run verify:netlify:build
```

## Start Codemagic

1. https://codemagic.io → **gatorvault-api**
2. Workflow **iOS Release Build** (`ios-release`)
3. Branch **`main`** (after this bump merges)
4. **Start new build**

## App Store Connect

1. Create version **1.0.7** (new train)
2. Attach build **33** when processing finishes
3. Submit for review when ready

## Whats New (short)

GatorVault elite Home brand hero, clearer recruiting narrative, faster never-late intel, and tighter Admin Hub daily ops.
