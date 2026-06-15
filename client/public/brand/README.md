# 🐊 GatorVault Brand System

Welcome to the official GatorVault brand directory.  
This folder contains all identity assets, design tokens, logo files, usage rules, and social media kits for the GatorVault platform.

The GatorVault brand is built around three pillars:

1. **The Swamp at Night** — dark, electric, powerful  
2. **GameDay Energy** — motion, hype, momentum  
3. **Insider Access** — clarity, precision, intelligence

This directory includes:

- `/logos/` — Wordmark, GV monogram, Insider badges  
- `/textures/` — Stadium lights, swamp mist, turf stripe  
- `/gradients/` — Swamp Night, Blue Glow, Orange Fireline  
- `/logo-lockups/` — Horizontal, vertical, badge, and social lockups  
- `/social-kit/` — Twitter/X headers, profile icons, badges  
- `/press-kit/` — Press release, brand overview, launch campaign, content calendar  
- `/usage-guidelines.md` — Rules for logo, color, and typography usage  
- `/components/` — UI component references (buttons, cards, tabs, meters)

All assets follow the design tokens defined in:

- `client/lib/gatorvault-brand.css`
- `client/lib/gatorvault-copy.ts`
- `client/lib/gatorvault-brand-assets.ts`

## Brand Philosophy

GatorVault is the **heartbeat of Gator Nation** — a premium insider experience built on truth, movement, and momentum.  
Our brand reflects:

- **Intensity** (The Swamp at night)  
- **Precision** (data, movement, film)  
- **Energy** (GameDay, recruiting buzz)  
- **Authority** (insider access)

## React usage

```tsx
import { GatorVaultWordmark, GatorVaultMonogram } from '@/components/brand/GatorVaultWordmark';
import { InsiderBadge } from '@/components/brand/InsiderBadge';

<GatorVaultWordmark height={32} />
<GatorVaultMonogram height={48} />
<InsiderBadge level={3} size={48} />
```

Static URLs (export / CDN):

- `/brand/logos/gatorvault-wordmark.svg`
- `/brand/logos/gv-monogram.svg`
- `/brand/badges/badge-level-3.svg`

## Contact

For brand questions or asset requests, contact:  
**brand@gatorvault.com**
