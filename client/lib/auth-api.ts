import { getApiBase } from './big-board-api';
import { isNativeApp, nativeNavigationUrl } from './api-base';

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
  membershipRequired?: boolean;
  points?: number;
  pointsTier?: string;
  subscription?: {
    source?: string | null;
    status?: string | null;
    productId?: string | null;
    expiresAt?: string | null;
  } | null;
};

/** Keep in sync with native-boot-script.ts */
export const SESSION_KEY = 'gv_session';

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

function normalizeSession(session: AuthSession): AuthSession {
  const tier = effectiveTier(session);
  if (tier === session.tier) return session;
  return { ...session, tier };
}

function parseSessionRaw(raw: string | null | undefined): AuthSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.email || !parsed?.token) return null;
    return normalizeSession(parsed);
  } catch {
    return null;
  }
}

async function nativePreferences(): Promise<typeof import('@capacitor/preferences').Preferences | null> {
  if (typeof window === 'undefined' || !isNativeApp()) return null;
  try {
    const mod = await import('@capacitor/preferences');
    return mod.Preferences;
  } catch {
    return null;
  }
}

function persistNativeSession(raw: string | null): void {
  void (async () => {
    const prefs = await nativePreferences();
    if (!prefs) return;
    try {
      if (raw) await prefs.set({ key: SESSION_KEY, value: raw });
      else await prefs.remove({ key: SESSION_KEY });
    } catch {
      /* ignore */
    }
  })();
}

/** Sync read — localStorage only. Call ensureSessionHydrated() first on native. */
export function loadSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  try {
    return parseSessionRaw(localStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

export function saveSession(session: AuthSession): void {
  if (typeof window === 'undefined') return;
  const raw = JSON.stringify(normalizeSession(session));
  try {
    localStorage.setItem(SESSION_KEY, raw);
    window.dispatchEvent(new CustomEvent('gv-auth-changed'));
  } catch {
    /* ignore */
  }
  // iOS may reclaim WebView localStorage — mirror into native Preferences.
  persistNativeSession(raw);
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(SESSION_KEY);
    window.dispatchEvent(new CustomEvent('gv-auth-changed'));
  } catch {
    /* ignore */
  }
  persistNativeSession(null);
}

let hydratePromise: Promise<AuthSession | null> | null = null;

/**
 * Restore gv_session from Capacitor Preferences when iOS wiped localStorage.
 * Safe to call repeatedly — runs once per page load.
 */
export function ensureSessionHydrated(): Promise<AuthSession | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  const existing = loadSession();
  if (existing) return Promise.resolve(existing);
  if (!isNativeApp()) return Promise.resolve(null);
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    const prefs = await nativePreferences();
    if (!prefs) return null;
    try {
      const { value } = await prefs.get({ key: SESSION_KEY });
      const session = parseSessionRaw(value);
      if (!session) return null;
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        window.dispatchEvent(new CustomEvent('gv-auth-changed'));
      } catch {
        /* ignore */
      }
      return session;
    } catch {
      return null;
    }
  })();

  return hydratePromise;
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

/**
 * Validate stored session token with the API.
 * Only clears local session on definitive auth failures (401/403/404).
 * Transport / 5xx blips keep the local session so a cold API cannot kick users to Sign in.
 */
export async function verifyStoredSession(opts?: { keepLocalOnNetworkError?: boolean }): Promise<AuthSession | null> {
  await ensureSessionHydrated();
  const session = loadSession();
  if (!session?.token) return null;
  const base = getApiBase();
  const keepOnSoftFailure = opts?.keepLocalOnNetworkError !== false;
  try {
    const res = await fetch(`${base}/api/session`, {
      headers: { Authorization: `Bearer ${session.token}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      // Only a real expired/invalid token (401) logs the user out.
      // 403/404 from proxies or edge quirks must not wipe login.
      if (res.status === 401) {
        clearSession();
        return null;
      }
      // 403/404/408/429/5xx — keep local login.
      return keepOnSoftFailure ? session : null;
    }
    const data = (await res.json()) as { ok?: boolean; session?: AuthSession };
    if (!data.ok || !data.session?.email) {
      // Successful HTTP but invalid payload — treat as soft failure, not logout.
      return keepOnSoftFailure ? session : null;
    }
    const merged = normalizeSession({ ...session, ...data.session, token: session.token });
    saveSession(merged);
    return merged;
  } catch {
    if (!keepOnSoftFailure) {
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
  firstTouch?: {
    source?: string | null;
    medium?: string | null;
    campaign?: string | null;
    content?: string | null;
    term?: string | null;
    gclid?: string | null;
    fbclid?: string | null;
    referrer?: string | null;
    landingPath?: string | null;
    capturedAt?: string;
  } | null;
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
}): Promise<AuthSession & { trialExpired?: boolean; membershipUrl?: string }> {
  const res = await authPost<{
    ok?: boolean;
    error?: string;
    trialExpired?: boolean;
    membershipRequired?: boolean;
    membershipUrl?: string;
    session?: AuthSession;
  }>('/api/login', opts);

  // Legacy servers returned 402 with no session — keep a clear membership path.
  if (res.status === 402 && res.data.trialExpired && !res.data.session) {
    const err = new Error(res.data.error || 'Your trial has ended.') as Error & {
      trialExpired?: boolean;
      membershipUrl?: string;
    };
    err.trialExpired = true;
    err.membershipUrl = res.data.membershipUrl || '/vault/membership/?trial=ended';
    throw err;
  }

  if (!res.ok || !res.data.session) {
    throw new Error(res.data.error || 'Incorrect email or password.');
  }

  const session = normalizeSession(res.data.session);
  return {
    ...session,
    trialExpired: Boolean(
      res.data.trialExpired || res.data.membershipRequired || session.accessActive === false
    ),
    membershipUrl: res.data.membershipUrl || '/vault/membership/?trial=ended',
  };
}

export async function requestPasswordReset(email: string): Promise<{
  message: string;
  emailSent?: boolean;
}> {
  const res = await authPost<{
    ok?: boolean;
    error?: string;
    message?: string;
    emailSent?: boolean;
  }>('/api/auth/forgot-password', { email: email.trim().toLowerCase() });
  if (!res.ok) {
    throw new Error(res.data.error || 'Could not send reset email.');
  }
  return {
    message:
      res.data.message ||
      'If that email has a GatorVault account, we sent a password reset link.',
    emailSent: res.data.emailSent,
  };
}

export async function resetPasswordWithToken(opts: {
  email: string;
  token: string;
  password: string;
}): Promise<{ message: string }> {
  const res = await authPost<{
    ok?: boolean;
    error?: string;
    message?: string;
  }>('/api/auth/reset-password', {
    email: opts.email.trim().toLowerCase(),
    token: opts.token,
    password: opts.password,
  });
  if (!res.ok) {
    throw new Error(res.data.error || 'Could not reset password.');
  }
  return {
    message: res.data.message || 'Password updated. Sign in with your new password.',
  };
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