import { getApiBase } from './big-board-api';
import { nativeNavigationUrl } from './api-base';

export type PaymentTierId = 'locker' | 'film' | 'war';
export type AuthSession = {
  token: string;
  email: string;
  tier: PaymentTierId | string;
  name?: string;
  trialEnd?: string;
  trialEndISO?: string;
  createdAt?: string;
  daysLeft?: number | null;
  paid?: boolean;
  accessActive?: boolean;
  points?: number;
  pointsTier?: string;
  subscription?: {
    source?: string | null;
    status?: string | null;
    productId?: string | null;
  } | null;
};

const SESSION_KEY = 'gv_session';

/** Auth-only paths — never use as post-login ?next= destinations (avoids redirect loops). */
export const AUTH_ONLY_PATHS = [
  '/vault/login',
  '/vault/auth/callback',
  '/auth/callback',
  '/join',
] as const;

/** Hard navigate for sign-in / welcome — Capacitor needs /join/index.html, not bare /join/. */
export function replaceAuthLocation(path: string): void {
  if (typeof window === 'undefined') return;
  window.location.replace(nativeNavigationUrl(path));
}

/** Safe post-auth destination; strips membership/login/callback loops. */
export function safeAuthRedirectPath(next?: string | null, fallback = '/vault/'): string {
  const candidate = (next || '').trim();
  if (!candidate.startsWith('/')) return fallback;
  const path = candidate.replace(/\/$/, '') || '/';
  if (AUTH_ONLY_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) return fallback;
  return candidate;
}

/** Operator / staff accounts — war-tier access without public admin nav. */
export function isAdminAccount(email: string | null | undefined): boolean {
  const e = email?.trim().toLowerCase() ?? '';
  if (!e) return false;
  return (
    e.endsWith('@gatorvaultinsider.com') ||
    e === 'gatorvaultinsider@gmail.com' ||
    e === 'operator@gatorvault' ||
    e.includes('crourk')
  );
}

/** Highest paid tier for feature gates — operators always get war. */
export function effectiveTier(session: AuthSession | null | undefined): PaymentTierId | string {
  if (!session?.email) return 'locker';
  if (isAdminAccount(session.email)) return 'war';
  return session.tier || 'locker';
}

function normalizeSession(session: AuthSession): AuthSession {  const tier = effectiveTier(session);
  if (tier === session.tier) return session;
  return { ...session, tier };
}

export function loadSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.email || !parsed?.token) return null;
    return normalizeSession(parsed);
  } catch {
    return null;
  }
}

export function saveSession(session: AuthSession): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(normalizeSession(session)));    window.dispatchEvent(new CustomEvent('gv-auth-changed'));
  } catch {
    /* ignore */
  }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(SESSION_KEY);
    window.dispatchEvent(new CustomEvent('gv-auth-changed'));
  } catch {
    /* ignore */
  }
}

async function authPost<T>(path: string, body: Record<string, unknown>): Promise<{
  ok: boolean;
  status: number;
  data: T;
}> {
  const base = getApiBase();
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T;
  return { ok: res.ok, status: res.status, data };
}

/** Validate stored session token with the API — clears stale local sessions. */
export async function verifyStoredSession(opts?: { keepLocalOnNetworkError?: boolean }): Promise<AuthSession | null> {
  const session = loadSession();
  if (!session?.token) return null;
  const base = getApiBase();
  try {
    const res = await fetch(`${base}/api/session`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    if (!res.ok) {
      clearSession();
      return null;
    }
    const data = (await res.json()) as { ok?: boolean; session?: AuthSession };
    if (!data.ok || !data.session?.email) {
      clearSession();
      return null;
    }
    const merged = normalizeSession({ ...session, ...data.session, token: session.token });
    saveSession(merged);
    return merged;
  } catch {
    // Keep local session on transport failures unless caller opts out.
    if (opts?.keepLocalOnNetworkError === false) {
      clearSession();
      return null;
    }
    return session;
  }
}

export async function registerAccount(opts: {
  email: string;
  password: string;
  name: string;
  tier: PaymentTierId;
}): Promise<{
  session: AuthSession;
  emailSent?: boolean;
  trialReused?: boolean;
  trialExpired?: boolean;
}> {
  const res = await authPost<{
    ok?: boolean;
    error?: string;
    code?: string;
    session?: AuthSession;
    emailSent?: boolean;
    trialReused?: boolean;
    trialExpired?: boolean;
  }>('/api/register', opts);
  if (!res.ok || !res.data.session) {
    const err = new Error(res.data.error || 'Registration failed.') as Error & {
      code?: string;
      status?: number;
    };
    err.code = res.data.code;
    err.status = res.status;
    throw err;
  }
  return {
    session: normalizeSession(res.data.session),
    emailSent: res.data.emailSent,
    trialReused: res.data.trialReused,
    trialExpired: res.data.trialExpired,
  };
}

export async function loginAccount(opts: {
  email: string;
  password: string;
}): Promise<AuthSession> {
  const res = await authPost<{ ok?: boolean; error?: string; trialExpired?: boolean; session?: AuthSession }>(
    '/api/login',
    opts
  );
  if (res.status === 402 && res.data.trialExpired) {
    const err = new Error(res.data.error || 'Your trial has ended.') as Error & {
      trialExpired?: boolean;
      membershipUrl?: string;
    };
    err.trialExpired = true;
    err.membershipUrl = (res.data as { membershipUrl?: string }).membershipUrl || '/vault/membership/';
    throw err;
  }
  if (!res.ok || !res.data.session) {
    throw new Error(res.data.error || 'Incorrect email or password.');
  }
  return normalizeSession(res.data.session);
}

export async function deleteAccount(opts: {
  password: string;
  confirm: string;
}): Promise<void> {
  const session = loadSession();
  if (!session?.token) {
    throw new Error('Sign in to delete your account.');
  }
  const base = getApiBase();
  const res = await fetch(`${base}/api/account/delete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`,
    },
    body: JSON.stringify(opts),
  });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok || !data.ok) {
    throw new Error(data.error || 'Could not delete account.');
  }
  clearSession();
}