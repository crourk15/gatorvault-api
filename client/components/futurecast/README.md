# FutureCast components

Reusable UI for Big Board and Player Profiles 2.0.

**Spec:** `server/docs/futurecast-platform-spec.md` §4

| Component | Purpose |
|-----------|---------|
| `PlayerCard.tsx` | Big Board row/card (consumes `BigBoardPlayer`) |
| `BigBoardGrid.tsx` | Fetches `/api/big-board` and renders cards |
| `player/PlayerProfilePage.tsx` | Full profile shell (slug route) |
| `player/PlayerHeader.tsx` | Identity + scores header |
| `player/PlayerTabs.tsx` | Sticky tab nav + `?tab=` deep links |
| `player/*Tab.tsx` | Overview, HS, College, Portal, UF Fit, Signals |
| `player/RelatedPlayers.tsx` | Related players from `/api/players/:id/related` |
| `FitScoreBadge.tsx` | UF Fit Score™ badge (§5) |
| `PortalLikelihoodBadge.tsx` | Portal likelihood bar |
| `ReasonTags.tsx` | `reason_tags` chips |
| `ProfileTabs.tsx` | HS / College / Portal / War Room |
