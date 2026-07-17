'use client';

import { useCallback, useEffect, useState } from 'react';
import { isNativeApp, nativeNavigationUrl } from './api-base';
import { ensureSessionHydrated, loadSession, type AuthSession, type PaymentTierId } from './auth-api';
import { isFutureCastInsider } from './futurecast-insider';
import { insiderUnlockHref } from './navConfig';

export function useUser(): {
  user: AuthSession | null;
  isInsider: boolean;
  ready: boolean;
} {
  const [user, setUser] = useState<AuthSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const sync = () => {
      setUser(loadSession());
    };
    void ensureSessionHydrated().then(() => {
      if (cancelled) return;
      sync();
      setReady(true);
    });
    window.addEventListener('storage', sync);
    window.addEventListener('gv-auth-changed', sync);
    return () => {
      cancelled = true;
      window.removeEventListener('storage', sync);
      window.removeEventListener('gv-auth-changed', sync);
    };
  }, []);

  return {
    user,
    isInsider: isFutureCastInsider(user),
    ready,
  };
}

type UnlockOpts = {
  returnPath?: string;
  tier?: PaymentTierId;
};

/** Paywall unlock — recomputes when session loads (fixes iPad/Capacitor stale /join href). */
export function useInsiderUnlock(opts?: UnlockOpts): {
  href: string;
  navigate: () => void;
} {
  const returnPath = opts?.returnPath;
  const tier = opts?.tier;

  const resolveHref = useCallback(
    () => insiderUnlockHref({ returnPath, tier }),
    [returnPath, tier],
  );

  const [href, setHref] = useState(resolveHref);

  useEffect(() => {
    const refresh = () => setHref(resolveHref());
    refresh();
    window.addEventListener('gv-auth-changed', refresh);
    return () => window.removeEventListener('gv-auth-changed', refresh);
  }, [resolveHref]);

  const navigate = useCallback(() => {
    const dest = resolveHref();
    window.location.href = isNativeApp() ? nativeNavigationUrl(dest) : dest;
  }, [resolveHref]);

  return { href, navigate };
}
