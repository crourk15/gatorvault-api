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

export async function fetchSubscriptionStatus(): Promise<SubscriptionStatus> {
  const res = await fetch(`${getApiBase()}/api/subscription/status`, {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (res.status === 401) throw new Error('Sign in to view membership.');
  if (!res.ok) throw new Error('Could not load membership status.');
  return res.json() as Promise<SubscriptionStatus>;
}
