# Press Kit Assets

Export-ready files for journalists, partners, and marketing.  
Drop PNG exports into the paths below; SVG logos and badges are included.

## Folder structure

```
/brand/press-kit/assets/
  logos/
    gatorvault-wordmark.svg      ✅ included
    gv-monogram.svg              ✅ included
    gatorvault-wordmark.png      ⬜ export @2x, min 320px wide
    gv-monogram.png              ⬜ export 512×512
  badges/
    badge-level-1.svg … 5.svg    ✅ included
  dashboard/
    gameday-dashboard-hero.png
    gameday-dashboard-movement-intel.png
    gameday-dashboard-recruiting-snapshot.png
  social/
    twitter-header.png           ⬜ 1500×500 (see social-kit SVG)
    twitter-avatar.png           ⬜ 400×400
    youtube-banner.png           ⬜ 2560×1440 safe area 1546×423
    instagram-avatar.png         ⬜ 400×400, 10% radius
  textures/
    stadium-lights.png           ⬜ subtle bokeh overlay
    swamp-mist.png
    turf-stripe.png
```

## Export notes

- **Logos:** Export PNG from SVG with transparent background.
- **Dashboard:** Capture from `/vault` at 1280px viewport; use Swamp Night chrome.
- **Social:** Match specs in [`/brand/social-kit/`](../../social-kit/README.md).
- **Textures:** 10–25% opacity when composited; see [`/brand/textures/`](../../textures/README.md).

Source SVG templates: [`/brand/social-kit/`](../../social-kit/)
