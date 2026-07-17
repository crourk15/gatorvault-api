# App Store 1.0.5 — Build 18

**Status:** Ready after Build 17 TestFlight verification.

**Version:** marketing 1.0.5 · build 18  
**Bundle:** `com.gatorvaultinsider.app`

## In this binary (on top of 17)

1. **Player profile HS / location fix** — On3 ingest no longer stores `hometown.abbr` (`City, ST`) as the high-school field. Profiles show real school names when known, and location stays on hometown city/state.
2. Runtime enrich + recruiting fallback reject hometown-as-school so already-stored bad rows do not render as duplicate HS/location.
3. Profile page clears prior slug state while loading so another player's school does not flash.

## Codemagic

Start **iOS Release Build** on `main` after this lands. Build 17 is already on TestFlight.
