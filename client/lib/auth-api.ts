import { getApiBase } from './big-board-api';

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
  points?: number;
  pointsTier?: string;
};

const SESSION_KEY = 'gv_session';

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

export async function registerAccount(opts: {
  email: string;
  password: string;
  name: string;
  tier: PaymentTierId;
}): Promise<{ session: AuthSession; emailSent?: boolean }> {
  const res = await authPost<{ ok?: boolean; error?: string; session?: AuthSession; emailSent?: boolean }>(
    '/api/register',
    opts
  );
  if (!res.ok || !res.data.session) {
    throw new Error(res.data.error || 'Registration failed.');
  }
  return { session: normalizeSession(res.data.session), emailSent: res.data.emailSent };}

export async function loginAccount(opts: {
  email: string;
  password: string;
}): Promise<AuthSession> {
  const res = await authPost<{ ok?: boolean; error?: string; trialExpired?: boolean; session?: AuthSession }>(
    '/api/login',
    opts
  );
  if (res.status === 402 && res.data.trialExpired) {
    const err = new Error(res.data.error || 'Your trial has ended.') as Error & { trialExpired?: boolean };
    err.trialExpired = true;
    throw err;
  }
  if (!res.ok || !res.data.session) {
    throw new Error(res.data.error || 'Incorrect email or password.');
  }
  return normalizeSession(res.data.session);
}