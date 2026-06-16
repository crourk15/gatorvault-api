'use client';

import React from 'react';
import { loadSession } from '@/lib/auth-api';
import { useUser } from '@/hooks/useUser';
import { siteGateRedirect } from '@/lib/site-routes';
import { usePathname } from '@/lib/use-pathname';

function isAuthenticated(email?: string | null, token?: string | null): boolean {
  return !!(email?.trim() && token?.trim());
}

function sessionLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  const session = loadSession();
  return isAuthenticated(session?.email, session?.token);
}

/** Static-export auth gate for gated product routes (/(app)/* only — not /welcome). */
export function AppRouteGate(): null {
  const pathname = usePathname();
  const { user, ready } = useUser();

  React.useEffect(() => {
    if (!ready) return;
    const p = pathname.replace(/\/$/, '') || '/';
    if (p.startsWith('/join') || p.startsWith('/insider') || p.startsWith('/welcome')) return;

    const loggedIn = sessionLoggedIn() || isAuthenticated(user?.email, user?.token);
    const dest = siteGateRedirect(pathname, loggedIn);
    if (dest) window.location.replace(dest);
  }, [pathname, ready, user?.email, user?.token]);

  return null;
}
