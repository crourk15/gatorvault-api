# Submit 1.0.5 (Build 28) — App Store / TestFlight

**Fix:** Team roster → player profile (Eric Singleton Jr. and other portal dual-listed roster names) no longer bounces to the marketing landing page on iPhone.

**iOS:** `MARKETING_VERSION = 1.0.5`, `CURRENT_PROJECT_VERSION = 28`.  
**Codemagic:** workflow `ios-release` on branch `main` (`submit_to_app_store: true`).

API-only deploys cannot fix this on an already-installed binary — Capacitor serves bundled HTML, and the catch-all player shell + boot-script restore must ship in a new build.

## Start Codemagic

1. https://codemagic.io → **gatorvault-api**
2. Workflow **iOS Release Build** (`ios-release`)
3. Branch **`main`**
4. **Start new build**

## TestFlight smoke

1. Team → Roster → tap **Eric Singleton Jr.** → roster profile stays in vault
2. Tap 2–3 other portal transfers on the roster → same
3. Tap a non-portal roster name (e.g. DJ Lagway if listed) → profile stays in vault
4. From Singleton profile, **View Portal Intel** stays in vault (does not land on marketing)
