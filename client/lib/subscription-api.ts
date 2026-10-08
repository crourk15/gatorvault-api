import { getApiBase } from '@/lib/big-board-api';
import { loadSession } from '@/lib/auth-api';
import type { PaymentTierId } from '@/lib/auth-api';
import { ApiFetchError, apiFetch } from '@/lib/api-fetch';

export type SubscriptionCatalogTier = {
  id: PaymentTierId;
  name: string;
  icon: string;
  monthlyUsd: number;
  annualUsd: number;
  popular?: boolean;
  products: {
    monthly: string;
    annual: string;
  };
  stripe?: {
    monthlyPriceId?: string | null;
    annualPriceId?: string | null;
    ready?: boolean;
  } | null;
};

export type SubscriptionStatus = {
  ok: boolean;
  email: string;
  tier: PaymentTierId | string;
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
    appleIapEnabled?: boolean;
    webCheckoutEnabled: boolean;
    appStoreUrl?: string;
    manageInAppHint: string;
    manageWebHint?: string;
    supportEmail: string;
    accountDeletionPath?: string;
  };
};

export type SubscriptionCatalog = {
  ok: boolean;
  provider: string;
  trialDays: number;
  subscriptionGroup: string;
  appAppleId?: string;
  appStoreUrl?: string;
  notificationsUrl?: string;
  membershipUrl?: string;
  tiers: SubscriptionCatalogTier[];
  iosPurchaseReady: boolean;
  webCheckoutEnabled?: boolean;
  stripe?: {
    enabled?: boolean;
    configured?: boolean;
    tiers?: Record<
      string,
      { monthlyPriceId?: string | null; annualPriceId?: string | null; ready?: boolean }
    >;
  };
};

function authHeaders(): HeadersInit {
  const session = loadSession();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;
  return headers;
}

/** WebKit/Capacitor often surfaces transport failures as "Load failed". */
export function isMembershipTransportError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return /load failed|failed to fetch|networkerror|network request failed|timed out|waking up|almost ready|502|503|504/i.test(
    err.message
  );
}

export function membershipLoadErrorMessage(err: unknown): string {
  if (isMembershipTransportError(err)) {
    return 'Membership service is waking up. Try again in a moment.';
  }
  return err instanceof Error && err.message
    ? err.message
    : 'Could not load membership. Check your connection and try again.';
}

export class MembershipAuthError extends Error {
  readonly status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = 'MembershipAuthError';
    this.status = status;
  }
}

export async function fetchSubscriptionCatalog(): Promise<SubscriptionCatalog> {
  try {
    return await apiFetch<SubscriptionCatalog>('/api/subscription/catalog?iap=1', {
      timeoutMs: 15_000,
      retries: 3,
      retryDelayMs: 1_500,
    });
  } catch (err) {
    if (err instanceof ApiFetchError && err.status && err.status >= 400 && err.status < 500) {
      throw new Error('Could not load membership catalog.');
    }
    throw new Error(membershipLoadErrorMessage(err));
  }
}

export async function fetchSubscriptionStatus(): Promise<SubscriptionStatus> {
  try {
    return await apiFetch<SubscriptionStatus>('/api/subscription/status', {
      headers: authHeaders(),
      timeoutMs: 15_000,
      retries: 3,
      retryDelayMs: 1_500,
    });
  } catch (err) {
    const status = err instanceof ApiFetchError ? err.status : undefined;
    if (status === 401 || status === 403 || status === 404) {
      throw new MembershipAuthError(
        err instanceof Error ? err.message : 'Sign in again to view membership.',
        status
      );
    }
    throw new Error(membershipLoadErrorMessage(err));
  }
}

export async function verifyApplePurchase(input: {
  productId: string;
  transactionId: string;
  appAccountToken?: string;
}): Promise<SubscriptionStatus> {
  const res = await fetch(`${getApiBase()}/api/subscription/apple/verify`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      productId: input.productId,
      transactionId: input.transactionId,
      appAccountToken: input.appAccountToken,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    hint?: string;
    status?: SubscriptionStatus;
  };
  if (!res.ok) {
    throw new Error(data.error || data.hint || 'Apple purchase verification failed.');
  }
  if (data.status) return data.status;
  return fetchSubscriptionStatus();
}

export async function restoreApplePurchase(input: {
  productId: string;
  transactionId: string;
  appAccountToken?: string;
}): Promise<SubscriptionStatus> {
  const res = await fetch(`${getApiBase()}/api/subscription/apple/restore`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      productId: input.productId,
      transactionId: input.transactionId,
      appAccountToken: input.appAccountToken,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    hint?: string;
    status?: SubscriptionStatus;
  };
  if (!res.ok) {
    throw new Error(data.error || data.hint || 'Apple restore verification failed.');
  }
  if (data.status) return data.status;
  return fetchSubscriptionStatus();
}

/** Web-only Stripe Checkout — do not call from the native iOS app. */
export async function startStripeCheckout(input: {
  tier: PaymentTierId | string;
  interval: 'monthly' | 'annual';
}): Promise<{ url: string }> {
  const res = await fetch(`${getApiBase()}/api/subscription/stripe/checkout`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    url?: string;
    error?: string;
    hint?: string;
  };
  if (!res.ok || !data.url) {
    throw new Error(data.error || data.hint || 'Could not start web checkout.');
  }
  return { url: data.url };
}

export async function openStripeBillingPortal(): Promise<{ url: string }> {
  const res = await fetch(`${getApiBase()}/api/subscription/stripe/portal`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    url?: string;
    error?: string;
  };
  if (!res.ok || !data.url) {
    throw new Error(data.error || 'Could not open billing portal.');
  }
  return { url: data.url };
}
