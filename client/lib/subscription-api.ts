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

async function readJsonSafe<T>(res: Response): Promise<T> {
  return (await res.json().catch(() => ({}))) as T;
}

export async function fetchSubscriptionCatalog(): Promise<SubscriptionCatalog> {
  let res: Response;
  try {
    res = await fetch(`${getApiBase()}/api/subscription/catalog`, { cache: 'no-store' });
  } catch (err) {
    throw new Error(membershipLoadErrorMessage(err));
  }
  if (!res.ok) {
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      throw new Error('Membership service is waking up. Try again in a moment.');
    }
    throw new Error('Could not load membership catalog.');
  }
  return res.json() as Promise<SubscriptionCatalog>;
}

async function subscriptionStatusError(res: Response): Promise<Error> {
  const data = await readJsonSafe<{ error?: string }>(res);
  if (res.status === 401 || res.status === 403 || res.status === 404) {
    return new MembershipAuthError(data.error || 'Sign in again to view membership.', res.status);
  }
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    return new Error('Membership service is waking up. Try again in a moment.');
  }
  return new Error(data.error || 'Could not load membership status.');
}

export async function fetchSubscriptionStatus(): Promise<SubscriptionStatus> {
  let res: Response;
  try {
    res = await fetch(`${getApiBase()}/api/subscription/status`, {
      headers: authHeaders(),
      cache: 'no-store',
    });
  } catch (err) {
    throw new Error(membershipLoadErrorMessage(err));
  }
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
