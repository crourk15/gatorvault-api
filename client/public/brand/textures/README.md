# GatorVault Textures

Approved textures are implemented in CSS (`client/lib/gatorvault-brand.css`).

| Texture | CSS Class | Opacity |
|---------|-----------|---------|
| Stadium Lights (bokeh) | `.gv-texture-stadium-lights` | 6–10% |
| Swamp Mist | `.gv-texture-swamp-mist` | 10–25% |
| Turf Stripe | `.gv-texture-turf` | 6% |

## Usage

Apply to a positioned container:

```html
<section class="gv-texture-stadium-lights gv-texture-swamp-mist">
  <!-- content -->
</section>
```

For Game Week surfaces, add `.gv-texture-turf` sparingly.

PNG exports (`stadium-lights.png`, `swamp-mist.png`, `turf-stripe.png`) may be added here for non-CSS contexts (email, social export).  
Until then, use the CSS utilities above in the web app.
