import { effectiveTier, type AuthSession, type PaymentTierId } from './auth-api';

export type PricingTier = {
  id: PaymentTierId;
  icon: string;
  name: string;
  monthly: number;
  annual: number;
  popular?: boolean;
  features: string[];
};

/** Mirrors server `TIER_LEVELS` in session-auth.js */
export const TIER_LEVELS: Record<PaymentTierId, number> = {
  locker: 0,
  film: 1,
  war: 2,
};

export function tierLevel(tier: string | null | undefined): number {
  const t = String(tier || '').toLowerCase();
  if (t === 'war' || t === 'elite') return TIER_LEVELS.war;
  if (t === 'film') return TIER_LEVELS.film;
  return TIER_LEVELS.locker;
}

export function hasPaymentTier(
  sessionOrTier: AuthSession | string | null | undefined,
  minTier: PaymentTierId,
): boolean {
  const tier =
    sessionOrTier && typeof sessionOrTier === 'object'
      ? effectiveTier(sessionOrTier)
      : sessionOrTier;
  return tierLevel(tier) >= tierLevel(minTier);
}

export function formatMonthlyPrice(amount: number): string {
  return `$${amount.toFixed(2)} / month`;
}

/**
 * All payment tiers (billing + access). War stays in the system for early insiders / ?tier=war.
 * Public marketing surfaces use `publicPricingTiers()` — Locker + Film only (Option A).
 */
export const PRICING_TIERS: PricingTier[] = [
  {
    id: 'locker',
    icon: '🏟️',
    name: 'Locker Room',
    monthly: 4.99,
    annual: 3.99,
    features: [
      'Recruiting board + 2027 targets',
      'Portal tracker + visit intel',
      'NIL snapshot + live feed',
      'Depth chart + team hub',
    ],
  },
  {
    id: 'film',
    icon: '🎬',
    name: 'Film Room',
    monthly: 9.99,
    annual: 7.99,
    popular: true,
    features: [
      'Everything in Locker Room',
      'FutureCast — UF probabilities & movement',
      'Fit scores, staff notes & signal intel',
      'Film Room breakdowns + Game Week',
    ],
  },
  {
    id: 'war',
    icon: '⚔️',
    name: 'War Room',
    monthly: 19.99,
    annual: 15.99,
    features: [
      'Everything in Film Room',
      'Early-access insider layer (in development)',
    ],
  },
];

/** Two-tier public offer — welcome, insider landing, legacy marketing page. */
export function publicPricingTiers(): PricingTier[] {
  return PRICING_TIERS.filter((t) => t.id === 'locker' || t.id === 'film');
}

export function findPricingTier(id: PaymentTierId): PricingTier {
  return PRICING_TIERS.find((t) => t.id === id) ?? PRICING_TIERS[1];
}

export type FeatureAccessCell = '—' | 'Limited' | 'Basic' | 'Read-only' | 'Teaser' | 'Full' | 'Yes';

export type PublicFeatureComparisonRow = {
  feature: string;
  free: FeatureAccessCell;
  locker: FeatureAccessCell;
  film: FeatureAccessCell;
};

/** Free vs Locker vs Film — public two-tier compare table. */
export const PUBLIC_FEATURE_COMPARISON_ROWS: PublicFeatureComparisonRow[] = [
  {
    feature: 'Recruiting Hub',
    free: 'Limited',
    locker: 'Full',
    film: 'Full',
  },
  {
    feature: 'Portal Tracker',
    free: 'Limited',
    locker: 'Full',
    film: 'Full',
  },
  {
    feature: 'NIL Tracker',
    free: 'Limited',
    locker: 'Full',
    film: 'Full',
  },
  {
    feature: 'Heat Check',
    free: 'Full',
    locker: 'Full',
    film: 'Full',
  },
  {
    feature: 'FutureCast',
    free: 'Teaser',
    locker: 'Teaser',
    film: 'Full',
  },
  {
    feature: 'Staff Notes',
    free: '—',
    locker: '—',
    film: 'Full',
  },
  {
    feature: 'Film Room + Game Week',
    free: '—',
    locker: '—',
    film: 'Full',
  },
];

/** @deprecated Internal — full matrix incl. War for admin/docs. */
export type FeatureComparisonRow = PublicFeatureComparisonRow & {
  war: FeatureAccessCell;
};

/** @deprecated Use PUBLIC_FEATURE_COMPARISON_ROWS on marketing pages. */
export const FEATURE_COMPARISON_ROWS: FeatureComparisonRow[] = [
  ...PUBLIC_FEATURE_COMPARISON_ROWS.map((row) => ({ ...row, war: 'Full' as const })),
  {
    feature: 'War Room Scouting',
    free: '—',
    locker: '—',
    film: '—',
    war: 'Full',
  },
];

export const LANDING_FEATURES = [
  {
    icon: '📈',
    title: 'FutureCast',
    desc: '2027 recruiting intelligence — UF probability, Fit Score, movement heatmaps, and portal watchlist.',
    href: '/futurecast',
  },
  {
    icon: '📋',
    title: 'Interactive Depth Chart',
    desc: 'Clickable position cards, 1–3 deep, Locked/Battle/Watch status, updated weekly.',
    href: '/vault/depth-chart',
  },
  {
    icon: '🎯',
    title: 'Recruiting Board',
    desc: '2026 class + 2027 targets, priority tiers, staff notes, and eval status.',
    href: '/vault/recruiting/board',
  },
  {
    icon: '🔄',
    title: 'Portal Radar',
    desc: 'Every Gator portal addition tracked — On3-sourced intel and full player pages.',
    href: '/vault/portal',
  },
  {
    icon: '🎬',
    title: 'Film Room',
    desc: 'Scheme hubs, film breakdowns, press conferences, and positional insights.',
    href: '/vault/film-room',
  },
  {
    icon: '🏈',
    title: 'Game Week Mode',
    desc: 'Win probability, 3 keys, swing players, film notes, and GatorVault predictions.',
    href: '/vault/game-week',
  },
];
