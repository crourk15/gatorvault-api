# Welcome Page (Elite Version)

The `/welcome` route contains the full implementation of the GatorVault **Elite Welcome Page** — the primary marketing and conversion surface for new users. This page introduces the platform, previews premium features, and drives signups for Free and Insider tiers.

**Route:** `/welcome`  
**Page entry:** `client/app/welcome/page.tsx`  
**Components:** `client/components/welcome/`  
**Styles:** `client/lib/welcome-elite.css`  
**Copy:** `client/components/welcome/content.ts`  
**Links:** `client/components/welcome/links.ts`

---

## Purpose

The Welcome Page serves three core goals:

1. **Brand Positioning**  
   Present GatorVault as the most premium, data-driven Florida recruiting platform.

2. **Feature Education**  
   Showcase FutureCast Elite, Recruiting Hub, and Film Room with high-impact visuals.

3. **Conversion**  
   Drive users toward:
   - **Start Free**
   - **Become an Insider**

---

## Page Structure

The page is composed of six major sections:

1. **HeroSection**
   - Cinematic Swamp-Night theme
   - Stadium lights + mist overlay
   - Headline + subheadline
   - Primary + secondary CTAs
   - Stats row
   - Feature preview cards

2. **FutureCastPreview**
   - Trending Board
   - Movement Intel
   - Staff Notes
   - Confidence + heatmap messaging

3. **RecruitingHubPreview**
   - High Priority Targets
   - Class Rankings
   - Portal Tracker
   - Scouting Reports

4. **FilmRoomPreview**
   - Highlights
   - Cut-ups
   - Player evaluations

5. **InsiderBenefits**
   - FutureCast Elite
   - Staff Notes
   - Portal Intel
   - Game Week & Live

6. **FooterCTA**
   - Final conversion block
   - “Start Free” + “Become an Insider”
   - Sticky mobile CTA (`WelcomeStickyCTA`)

---

## Visual System

The Welcome Page uses the **Elite Dark Theme**, consistent with FutureCast Elite:

- **Swamp-Night gradient**
- **UF-blue glow accents**
- **Neon orange CTA**
- **Mist + stadium light overlays** (`/textures/stadium-lights.png`, `/textures/swamp-mist.png`)
- **gv-token spacing, radius, and typography** (aligned with `futurecast-elite.css`)
- **Frosted glass cards** (`rgba(255,255,255,0.04)`)

All colors, shadows, and radii are defined in:

```
client/lib/welcome-elite.css
```

---

## Component Architecture

```
client/
├── app/welcome/page.tsx          # Route entry (imports CSS + PublicSiteShell)
├── components/welcome/
│   ├── WelcomePage.tsx           # Section orchestrator
│   ├── HeroSection.tsx
│   ├── WelcomePreviewSection.tsx # FutureCast, Recruiting, Film Room, Insider exports
│   ├── FooterCTA.tsx             # Footer + WelcomeStickyCTA
│   ├── content.ts                # All static copy (source of truth)
│   ├── links.ts                  # CTA + card href map
│   └── README.md
└── lib/
    └── welcome-elite.css         # Theme tokens + layout
```

Each component is self-contained and uses:

- `welcome-*` class namespace
- gv-token spacing + radius where shared with Elite pages
- Responsive grid layout
- Shared CTA classes (`welcome-cta-primary`, `welcome-cta-secondary`)

---

## Mobile Behavior

- Hero collapses to a single column
- Cards stack vertically
- CTAs remain sticky and centered (mobile sticky bar)
- Typography scales down using fluid units (`clamp()` on hero title)
- All grids convert to `1fr`

---

## Animations

### Card Hover

- `translateY(-4px)`
- Shadow intensifies
- Border brightens

### CTA Hover

- Primary: brightness bump
- Secondary: border shifts to orange

### Hero Background

- Subtle opacity pulse on stadium-lights overlay (`heroGlow`)
- Particle drift on hero layer

---

## Content Source of Truth

All copy used on the Welcome Page is stored in:

```
client/components/welcome/content.ts
```

Navigation hrefs are mapped in:

```
client/components/welcome/links.ts
```

Main site nav (auth-aware) is configured in:

```
client/components/NavBar.tsx
client/lib/navConfig.ts
client/hooks/useUser.ts
client/components/VaultRouteGate.tsx
```

A/B welcome variants:

```
client/components/welcome/ABWelcomePage.tsx  # 50/50 localStorage split
client/components/welcome/WelcomeA.tsx       # Dark Elite (Variant A)
client/components/welcome/WelcomeB.tsx       # Bright UF-blue (Variant B)
```

Conversion table: `client/components/InsiderComparisonTable.tsx`

Preview section anchors for logged-out nav:

| Nav item | Anchor |
|----------|--------|
| FutureCast | `#futurecast-preview` |
| Recruiting | `#recruiting-preview` |
| Film Room | `#film-preview` |

Root `/` redirects to `/welcome` via `server/_redirects` and `netlify.toml`.

This includes:

- Hero title + subtitle
- Section titles
- Section descriptions
- Card descriptions
- CTA labels

---

## Integration Notes

- No API calls are made on the Welcome Page
- All content is static
- All images/textures are local assets (`/brand/logos/`, `/textures/`)
- Page must load instantly (LCP target < 1.5s)
- Prefer optimized local assets for hero textures when PNGs are added

---

## Deployment Notes

- This page is part of the **public** site
- No authentication required
- Must be fully responsive
- Must match the Elite visual identity
- Must pass Lighthouse accessibility checks

---

## Requirements Checklist

- [ ] Hero renders correctly on all breakpoints
- [ ] CTAs are functional and trackable
- [ ] Cards use correct gv-token spacing
- [ ] Dark theme matches FutureCast Elite
- [ ] No layout shift on mobile
- [ ] All text readable at AA contrast
- [ ] Animations performant (no jank)

---

## Summary

The Welcome Page is the **front door** of GatorVault.  
It must feel premium, modern, and unmistakably “Elite.”  
This README defines the structure, visuals, content, and coding standards required to maintain that quality.
