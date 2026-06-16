'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { prefetchVaultHref, notifyVaultNavigation } from '@/lib/vault-navigation';
import { isVaultClientNavHref, vaultNavPathsEqual } from '@/lib/vault-nav-utils';

type VaultNavContextValue = {
  isNavigating: boolean;
  beginNavigation: () => void;
};

const VaultNavContext = createContext<VaultNavContextValue | null>(null);

export function useVaultNavigation(): VaultNavContextValue {
  const ctx = useContext(VaultNavContext);
  if (!ctx) {
    return { isNavigating: false, beginNavigation: () => {} };
  }
  return ctx;
}

type Props = {
  children: React.ReactNode;
};

/** Client-side vault routing — keeps VaultShell mounted during in-vault navigations. */
export function VaultNavigationProvider({ children }: Props): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);

  const beginNavigation = useCallback(() => {
    setIsNavigating(true);
  }, []);

  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;

      const anchor = (event.target as Element | null)?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      if (!anchor.closest('.gv-vault-shell')) return;
      if (anchor.hasAttribute('data-vault-nav') || anchor.hasAttribute('data-no-vault-nav')) return;

      const href = anchor.getAttribute('href');
      if (!href || !isVaultClientNavHref(href)) return;

      const current = `${window.location.pathname}${window.location.search}`;
      if (vaultNavPathsEqual(href, current)) {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      beginNavigation();
      prefetchVaultHref(href.split('?')[0].split('#')[0]);
      router.push(href);
      notifyVaultNavigation();
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [router, beginNavigation]);

  const value = useMemo(
    () => ({ isNavigating, beginNavigation }),
    [isNavigating, beginNavigation]
  );

  return <VaultNavContext.Provider value={value}>{children}</VaultNavContext.Provider>;
}
