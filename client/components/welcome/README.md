# Welcome Page (Elite Version)

This folder contains the full implementation of the GatorVault Welcome Page.

**Route:** `/welcome`  
**Styles:** `client/lib/welcome-elite.css`  
**Copy:** `client/lib/welcome-copy.ts`

## Goals

- Present GatorVault as a premium, elite recruiting platform.
- Drive conversions to Insider.
- Showcase FutureCast, Recruiting Hub, and Film Room.

## Sections

1. `HeroSection` — cinematic hero, stats, 3-tier preview cards
2. `FutureCastPreview` — Trending, Movement Intel, Staff Notes
3. `RecruitingHubPreview` — High Priority, Rankings, Portal, Scouting
4. `FilmRoomPreview` — Highlights, Cut-ups, Player evals
5. `InsiderBenefits` — conversion grid
6. `FooterCTA` + `WelcomeStickyCTA` — mobile sticky bar

## Visual System

- Swamp Night gradient
- Stadium lights + mist overlays (`/textures/`)
- Subtle particle drift
- Neon orange + UF blue accents
- Complements `gv-*` tokens on Elite product pages

## CTA Strategy

| CTA | Target |
|-----|--------|
| Start Free (primary) | `/join` |
| See Inside (secondary) | `/vault/futurecast` |
| Become an Insider | `/join` |

## Layout

- Hero: 2-column grid (copy + preview), 1 column on mobile
- Sections: max-width 1120px, centered card grids
- Cards: `minmax(220px, 1fr)` responsive grid
- Hover: lift, shadow, border brighten

## Notes

- Mobile-first; sticky CTA on viewports ≤768px
- All copy lives in `welcome-copy.ts` — edit there, not inline
- Do not merge UF %, Staff %, and Fit % in marketing copy
