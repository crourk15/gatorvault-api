# Agent Handoff — App priority harden (post Build 36)

## Context

Owner submitted **1.0.8 Build 36** (Film Room scroll + hero). LLC/EIN seller conversion is **paused** (waiting on EIN).

## This branch / next binary (Build 37)

1. **Web↔app drift** — docs + GitHub→Codemagic TestFlight trigger; `submit_to_app_store: false` for ongoing TF
2. **Deep links** — `appUrlOpen`, Associated Domains, cold-start preserves deep vault paths
3. **IAP restore** — `getPurchases` fallback + clearer empty restore UX
4. **Push** — absolute site URLs normalize to in-app paths
5. **Community** — “Jump in today”, clickable topics, Game Week rooms start a thread

## Still human-gated

| Item | Why |
|------|-----|
| Add `CODEMAGIC_API_TOKEN` + `CODEMAGIC_APP_ID` to GitHub Secrets | Enables auto TF on main |
| Netlify `APPLE_TEAM_ID` | Real AASA appIDs for universal links |
| Device: sandbox IAP restore + push tap deep link | Physical TestFlight |
| LLC EIN → D‑U‑N‑S → Apple org seller | Owner waiting on EIN |
