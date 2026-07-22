'use client';

import React from 'react';
import { isNativeApp, nativeNavigationUrl } from '@/lib/api-base';
import { ensureSessionHydrated, loadSession, replaceAuthLocation, verifyStoredSession } from '@/lib/auth-api';
import { useUser } from '@/hooks/useUser';
import { vaultGateRedirect } from '@/lib/navConfig';
import { usePathname } from '@/lib/use-pathname';
const AUTH_HANDOFF_KEY = 'gv_auth_handoff';
const LAST_VERIFY_KEY = 'gv_session_last_verify_ms';
const VERIFY_MIN_INTERVAL_MS = 60_000;

const VAULT_AUTH_PATHS = ['/vault/login', '/vault/membership', '/vault/auth/callback', '/auth/callback'];

function isVaultAuthPath(pathname: string): boolean {
  const p = pathname.replace(/\/$/, '') || '/';
  return VAULT_AUTH_PATHS.some((base) => p === base || p.startsWith(`${base}/`));
}

function isAuthenticated(email?: string | null, token?: string | null): boolean {
  return !!(email?.trim() && token?.trim());
}

/** Prefer localStorage on gate checks — useUser can lag one tick after full-page login redirect. */
function sessionLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  const session = loadSession();
  return isAuthenticated(session?.email, session?.token);
}

function shouldVerifyNow(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const last = Number(sessionStorage.getItem(LAST_VERIFY_KEY) || 0);
    if (Number.isFinite(last) && Date.now() - last < VERIFY_MIN_INTERVAL_MS) return false;
    sessionStorage.setItem(LAST_VERIFY_KEY, String(Date.now()));
    return true;
  } catch {
    return true;
  }
}

/**
 * Static-export substitute for middleware.ts vault protection.
 * Logged-out visitors on /vault/futurecast|recruiting|film-room → join sign-in.
 * Soft API failures must not wipe login; only confirmed expired trials go to Membership.
 */
export function VaultRouteGate(): null {
  const pathname = usePathname();
  const { user, ready } = useUser();

  React.useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    void (async () => {
      // Restore native Preferences → localStorage before any sign-in bounce.
      await ensureSessionHydrated();
      if (cancelled) return;

      const p = pathname.replace(/\/$/, '') || '/';
      if (p.startsWith('/join') || p.startsWith('/insider') || p.startsWith('/welcome')) return;
      if (isVaultAuthPath(p)) return;

      const handoff =
        typeof window !== 'undefined' && sessionStorage.getItem(AUTH_HANDOFF_KEY) === '1';
      const loggedIn = sessionLoggedIn() || isAuthenticated(user?.email, user?.token);

      if (handoff) {
        if (loggedIn) {
          sessionStorage.removeItem(AUTH_HANDOFF_KEY);
          return;
        }
        // Handoff without a session must not leave gated routes open forever.
        const started = Number(sessionStorage.getItem(`${AUTH_HANDOFF_KEY}_at`) || 0);
        if (!started) {
          sessionStorage.setItem(`${AUTH_HANDOFF_KEY}_at`, String(Date.now()));
          return;
        }
        if (Date.now() - started < 8_000) return;
        sessionStorage.removeItem(AUTH_HANDOFF_KEY);
        sessionStorage.removeItem(`${AUTH_HANDOFF_KEY}_at`);
      }

      // Gate only on local session presence — never wait on network for nav.
      const dest = vaultGateRedirect(pathname, loggedIn);
      if (dest) {
        window.location.replace(isNativeApp() ? nativeNavigationUrl(dest) : dest);
        return;
      }

      if (!loggedIn || !shouldVerifyNow()) return;

      const session = await verifyStoredSession({ keepLocalOnNetworkError: true });
      if (cancelled || !session) return;
      // Only redirect after a confirmed server payload saying access is inactive.
      // Soft failures return the local session without overwriting accessActive.
      if (session.paid) return;
      if (session.accessActive === false && session.trialEndISO) {
        const end = Date.parse(session.trialEndISO);
        if (Number.isFinite(end) && end <= Date.now()) {
          replaceAuthLocation('/vault/membership/?trial=ended');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, ready, user?.email, user?.token]);

  return null;
}
