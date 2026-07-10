import { getApiBase } from '@/lib/big-board-api';
import { loadSession } from '@/lib/auth-api';
import type { PaymentTierId } from '@/lib/auth-api';

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
    appleIapEnabled: boolean;
    webCheckoutEnabled: boolean;
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
  tiers: SubscriptionCatalogTier[];
  iosPurchaseReady: boolean;
};

function authHeaders(): HeadersInit {
  const session = loadSession();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;
  return headers;
}

export async function fetchSubscriptionCatalog(): Promise<SubscriptionCatalog> {
  const res = await fetch(`${getApiBase()}/api/subscription/catalog`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Could not load membership catalog.');
  return res.json() as Promise<SubscriptionCatalog>;
}

async function subscriptionStatusError(res: Response): Promise<Error> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (res.status === 401 || res.status === 404) {
    return new Error(data.error || 'Sign in again to view membership.');
  }
  if (res.status === 502 || res.status === 503) {
    return new Error('Membership service is waking up. Try again in a moment.');
  }
  return new Error(data.error || 'Could not load membership status.');
}

export async function fetchSubscriptionStatus(): Promise<SubscriptionStatus> {
  const res = await fetch(`${getApiBase()}/api/subscription/status`, {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) throw await subscriptionStatusError(res);
  return res.json() as Promise<SubscriptionStatus>;
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
