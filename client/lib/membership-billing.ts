import type { SubscriptionCatalog, SubscriptionCatalogTier } from './subscription-api';

/** Same IDs as server/lib/subscription-config.js — used when the live catalog never lands. */
export const FALLBACK_APPLE_TIERS: SubscriptionCatalogTier[] = [
  {
    id: 'locker',
    name: 'Locker Room',
    icon: '🏟️',
    monthlyUsd: 4.99,
    annualUsd: 47.88,
    products: {
      monthly: 'com.gatorvaultinsider.locker.monthly',
      annual: 'com.gatorvaultinsider.locker.annual',
    },
  },
  {
    id: 'film',
    name: 'Film Room',
    icon: '🎬',
    monthlyUsd: 9.99,
    annualUsd: 95.88,
    popular: true,
    products: {
      monthly: 'com.gatorvaultinsider.film.monthly',
      annual: 'com.gatorvaultinsider.film.annual',
    },
  },
  {
    id: 'war',
    name: 'War Room',
    icon: '⚔️',
    monthlyUsd: 19.99,
    annualUsd: 191.88,
    products: {
      monthly: 'com.gatorvaultinsider.war.monthly',
      annual: 'com.gatorvaultinsider.war.annual',
    },
  },
];

export type MembershipBillingNotice = 'iap' | 'open-app' | 'web' | 'loading' | 'storekit-down' | 'unavailable';

export function resolveMembershipTiers(
  catalog: SubscriptionCatalog | null | undefined
): SubscriptionCatalogTier[] {
  const live = catalog?.tiers?.filter((tier) => tier?.products?.monthly && tier?.products?.annual);
  return live?.length ? live : FALLBACK_APPLE_TIERS;
}

export function membershipIapUnlocked(input: {
  native: boolean;
  billingReady: boolean;
}): boolean {
  return Boolean(input.native && input.billingReady);
}

export function membershipBillingNotice(input: {
  native: boolean;
  billingReady: boolean;
  iosPurchaseReady: boolean;
  appleIapEnabled?: boolean;
  webCheckoutReady: boolean;
  loaded: boolean;
}): MembershipBillingNotice {
  if (input.native && input.billingReady) return 'iap';
  if (!input.loaded) return 'loading';
  if (input.native) return 'storekit-down';
  if (input.iosPurchaseReady || input.appleIapEnabled) return 'open-app';
  if (input.webCheckoutReady) return 'web';
  return 'unavailable';
}
