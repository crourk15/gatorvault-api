import type { SubscriptionCatalog, SubscriptionCatalogTier } from './subscription-api';

/** Same IDs as server/lib/subscription-config.js — used when the live catalog never lands. */
export const FALLBACK_APPLE_TIERS: SubscriptionCatalogTier[] = [
  {
    id: 'locker',
    name: 'Locker Room',
    icon: '\u26fa\ufe0f',
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
    icon: '\U0001f3ac',
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
    icon: '\u2694\ufe0f',
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

export function shouldShowMembershipLoadError(input: {
  statusOk: boolean;
  authError: boolean;
  transportError: boolean;
  hasLocalEmail: boolean;
}): boolean {
  if (input.statusOk) return false;
  if (input.authError) return true;
  if (input.transportError && input.hasLocalEmail) return false;
  return true;
}

export function statusFromLocalSession(session: {
  email: string;
  tier?: string;
  paid?: boolean;
  accessActive?: boolean;
  trialEnd?: string;
  trialEndISO?: string;
  daysLeft?: number | null;
  subscription?: {
    source?: string | null;
    status?: string | null;
    productId?: string | null;
    expiresAt?: string | null;
  } | null;
}): {
  ok: true;
  email: string;
  tier: string;
  paid: boolean;
  accessActive: boolean;
  trial: {
    trialEndISO: string | null;
    trialEndFormatted: string | null;
    daysLeft: number | null;
    expired: boolean;
  };
  subscription: {
    source: string | null;
    status: string | null;
    productId: string | null;
    tier: string | null;
    expiresAt: string | null;
    updatedAt: string | null;
  } | null;
  billing: {
    webCheckoutEnabled: false;
    manageInAppHint: string;
    supportEmail: string;
  };
} {
  const trialEndISO = session.trialEndISO || session.trialEnd || null;
  const paid = Boolean(session.paid);
  const daysLeft = session.daysLeft ?? null;
  return {
    ok: true,
    email: session.email,
    tier: session.tier || 'locker',
    paid,
    accessActive: session.accessActive ?? (paid || daysLeft == null || daysLeft > 0),
    trial: {
      trialEndISO,
      trialEndFormatted: null,
      daysLeft,
      expired: !paid && daysLeft === 0,
    },
    subscription: session.subscription
      ? {
          source: session.subscription.source || null,
          status: session.subscription.status || null,
          productId: session.subscription.productId || null,
          tier: null,
          expiresAt: session.subscription.expiresAt || null,
          updatedAt: null,
        }
      : null,
    billing: {
      webCheckoutEnabled: false,
      manageInAppHint:
        'Subscriptions purchased in the iOS app are managed in Settings \u2192 Apple ID \u2192 Subscriptions.',
      supportEmail: 'gatorvaultinsider@gmail.com',
    },
  };
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
