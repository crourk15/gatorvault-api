'use client';

import React from 'react';
import { loadSession } from '@/lib/auth-api';
import { useUser } from '@/hooks/useUser';
import { vaultGateRedirect } from '@/lib/navConfig';
import { usePathname } from '@/lib/use-pathname';

const AUTH_HANDOFF_KEY = 'gv_auth_handoff';

function isAuthenticated(email?: string | null, token?: string | null): boolean {
  return !!(email?.trim() && token?.trim());
}

/** Prefer localStorage on gate checks — useUser can lag one tick after full-page login redirect. */
function sessionLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  const session = loadSession();
  return isAuthenticated(session?.email, session?.token);
}

/**
 * Static-export substitute for middleware.ts vault protection.
 * Logged-out visitors on /vault/futurecast|recruiting|film-room → welcome preview anchors.
 */
export function VaultRouteGate(): null {
  const pathname = usePathname();
  const { user, ready } = useUser();

  React.useEffect(() => {
    if (!ready) return;
    const p = pathname.replace(/\/$/, '') || '/';
    if (p.startsWith('/join') || p.startsWith('/insider') || p.startsWith('/welcome')) return;

    const handoff =
      typeof window !== 'undefined' && sessionStorage.getItem(AUTH_HANDOFF_KEY) === '1';
    const loggedIn = sessionLoggedIn() || isAuthenticated(user?.email, user?.token);

    if (handoff) {
      if (loggedIn) sessionStorage.removeItem(AUTH_HANDOFF_KEY);
      return;
    }

    const dest = vaultGateRedirect(pathname, loggedIn);
    if (dest) window.location.replace(dest);
  }, [pathname, ready, user?.email, user?.token]);

  return null;
}
