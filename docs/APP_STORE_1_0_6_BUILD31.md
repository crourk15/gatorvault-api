# Submit 1.0.6 (Build 31) — App Store / TestFlight

**Fix:** Nav/menu labels say **Schedule** (not a standalone "Tickets" alias). Page still has Buy Tickets CTAs + per-game vendors.

**iOS:** `MARKETING_VERSION = 1.0.6`, `CURRENT_PROJECT_VERSION = 31`.  
**Codemagic:** `ios-release` on `main`.

## Start Codemagic

1. https://codemagic.io → **gatorvault-api**
2. Workflow **iOS Release Build** (`ios-release`)
3. Branch **`main`**
4. **Start new build**

## TestFlight smoke

1. Menu → Explore → **Schedule** (no Account → Tickets row)
2. Sidebar (if desktop web) → Schedule
3. Schedule page still shows Buy Tickets + vendor links
