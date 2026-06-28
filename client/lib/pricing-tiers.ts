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

/** Canonical paid tiers — keep aligned with server/lib/access-config.js */
export const PRICING_TIERS: PricingTier[] = [
  {
    id: 'locker',
    icon: '🏟️',
    name: 'Locker Room',
    monthly: 4.99,
    annual: 3.99,
    features: [
      'Premium articles + depth chart',
      'Press conferences & highlights',
      'Basic recruiting + portal updates',
      'Live feed (read-only)',
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
      'Film Room breakdowns + Scheme School',
      'FutureCast probabilities + movement intel',
      'Recruit fit evaluations + matchup spotlight',
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
      'Full War Room intel + Heat Check',
      'Insider recruiting intel + staff notes',
      'Portal + NIL tracker (full access)',
    ],
  },
];

export type FeatureAccessCell = '—' | 'Limited' | 'Basic' | 'Read-only' | 'Teaser' | 'Full' | 'Yes';

export type FeatureComparisonRow = {
  feature: string;
  free: FeatureAccessCell;
  locker: FeatureAccessCell;
  film: FeatureAccessCell;
  war: FeatureAccessCell;
};

/** Welcome / insider feature matrix — lowest tier that unlocks each row is implicit in columns. */
export const FEATURE_COMPARISON_ROWS: FeatureComparisonRow[] = [
  {
    feature: 'Recruiting Hub',
    free: 'Limited',
    locker: 'Full',
    film: 'Full',
    war: 'Full',
  },
  {
    feature: 'Player Profiles',
    free: 'Limited',
    locker: 'Basic',
    film: 'Full',
    war: 'Full',
  },
  {
    feature: 'Live Feed',
    free: 'Read-only',
    locker: 'Read-only',
    film: 'Read-only',
    war: 'Full',
  },
  {
    feature: 'FutureCast',
    free: 'Teaser',
    locker: 'Teaser',
    film: 'Full',
    war: 'Full',
  },
  {
    feature: 'Film Room',
    free: '—',
    locker: '—',
    film: 'Full',
    war: 'Full',
  },
  {
    feature: 'War Room Intel',
    free: '—',
    locker: '—',
    film: '—',
    war: 'Full',
  },
  {
    feature: 'Heat Check',
    free: '—',
    locker: '—',
    film: '—',
    war: 'Full',
  },
  {
    feature: 'Insider Chat',
    free: '—',
    locker: '—',
    film: '—',
    war: 'Yes',
  },
  {
    feature: 'NIL Tracker',
    free: 'Limited',
    locker: 'Limited',
    film: 'Limited',
    war: 'Full',
  },
  {
    feature: 'Portal Tracker',
    free: 'Limited',
    locker: 'Basic',
    film: 'Basic',
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
