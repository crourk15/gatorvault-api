'use client';

import React from 'react';
import { useUser } from '@/hooks/useUser';
import { vaultGateRedirect } from '@/lib/navConfig';
import { usePathname } from '@/lib/use-pathname';

/**
 * Static-export substitute for middleware.ts vault protection.
 * Logged-out visitors on /vault/futurecast|recruiting|film-room → welcome preview anchors.
 * Root / → /welcome is handled by netlify.toml + server/_redirects (middleware unsupported with output: 'export').
 */
export function VaultRouteGate(): null {
  const pathname = usePathname();
  const { user, ready } = useUser();

  React.useEffect(() => {
    if (!ready) return;
    const p = pathname.replace(/\/$/, '') || '/';
    if (p.startsWith('/join') || p.startsWith('/insider') || p.startsWith('/welcome')) return;
    const dest = vaultGateRedirect(pathname, !!user?.email);
    if (dest) window.location.replace(dest);
  }, [pathname, ready, user?.email]);

  return null;
}
