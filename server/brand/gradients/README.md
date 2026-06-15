# GatorVault Gradients

Approved gradients are implemented as CSS custom properties in `client/lib/gatorvault-brand.css`.

| Name | CSS Variable | Usage |
|------|--------------|-------|
| Swamp Night | `--gv-gradient-swamp-night` | Hero overlays, dark sections |
| Blue Glow | `--gv-gradient-blue-glow` | Hero backgrounds, cards |
| Orange Fireline | `--gv-gradient-orange-fire` | Accents, sparklines, CTAs |
| Momentum Meter | `--gv-gradient-momentum` | Progress bars, temperature meter |

## Values

```css
--gv-gradient-swamp-night: linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.15) 100%);
--gv-gradient-blue-glow: linear-gradient(90deg, #0021a5 0%, #0a0f1a 100%);
--gv-gradient-orange-fire: linear-gradient(90deg, #fa4616 0%, #ff7a45 100%);
--gv-gradient-momentum: linear-gradient(90deg, #fa4616 0%, #facc15 100%);
```

Never create one-off gradients outside this set.
