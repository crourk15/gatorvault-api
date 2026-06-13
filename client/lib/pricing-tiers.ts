import type { PaymentTierId } from './auth-api';

export type PricingTier = {
  id: PaymentTierId;
  icon: string;
  name: string;
  monthly: number;
  annual: number;
  popular?: boolean;
  features: string[];
};

export const PRICING_TIERS: PricingTier[] = [
  {
    id: 'locker',
    icon: '🏟️',
    name: 'Locker Room',
    monthly: 4.99,
    annual: 3.99,
    features: [
      'Premium articles',
      'Depth chart',
      'Press conferences',
      'Highlights',
      'Basic recruiting + portal updates',
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
      'Weekly Scheme School',
      'Play of the Week breakdowns',
      'Recruit fit evaluations',
      'Matchup spotlight',
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
      'Full War Room intel',
      'Heat Check access',
      'Insider recruiting intel',
      'Portal intel + priority alerts',
    ],
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
    href: '/vault/recruiting-board',
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
