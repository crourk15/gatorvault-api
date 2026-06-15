/**
 * GatorVault brand asset paths — served from /public/brand.
 */
export type InsiderBadgeLevel = 1 | 2 | 3 | 4 | 5;

export const BRAND_LOGOS = {
  wordmark: '/brand/logos/gatorvault-wordmark.svg',
  monogram: '/brand/logos/gv-monogram.svg',
} as const;

export const INSIDER_BADGE_LEVELS: Record<
  InsiderBadgeLevel,
  { name: string; src: string }
> = {
  1: { name: 'Swamp Rookie', src: '/brand/badges/badge-level-1.svg' },
  2: { name: 'Gator Loyalist', src: '/brand/badges/badge-level-2.svg' },
  3: { name: 'Insider', src: '/brand/badges/badge-level-3.svg' },
  4: { name: 'Elite Insider', src: '/brand/badges/badge-level-4.svg' },
  5: { name: 'The Swamp Legend', src: '/brand/badges/badge-level-5.svg' },
};

export function insiderBadgeSrc(level: InsiderBadgeLevel): string {
  return INSIDER_BADGE_LEVELS[level].src;
}

export function insiderBadgeName(level: InsiderBadgeLevel): string {
  return INSIDER_BADGE_LEVELS[level].name;
}

/** Map payment tier to default insider badge level for UI. */
export function badgeLevelForTier(tier?: string | null): InsiderBadgeLevel {
  switch (tier) {
    case 'war':
      return 5;
    case 'film':
      return 4;
    case 'locker':
      return 3;
    case 'founding':
      return 5;
    default:
      return 1;
  }
}
