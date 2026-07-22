'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { prefetchVaultHref, notifyVaultNavigation, warmVaultBottomNavRoutes, warmVaultDrawerRoutes, warmVaultPlayerRoute, warmRecruitingHubApi } from '@/lib/vault-navigation';
import { isVaultClientNavHref, vaultNavPathsEqual } from '@/lib/vault-nav-utils';
import { isPlayerProfileHref, playerSlugFromHref, prefetchFullProfile } from '@/lib/player-full-profile-api';
import { isNativeCatchAllDynamicHref, shouldUseNativeCatchAllNav } from '@/lib/native-spa-nav';
import { navigateVaultHref, registerVaultSoftNav } from '@/lib/navigate-vault-href';

function normalizeVaultNavHref(href: string): string {
  try {
    const url = new URL(href, 'https://gatorvaultinsider.com');
    if (!url.pathname.startsWith('/vault')) return href;
    const path = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
    return `${path}${url.search}${url.hash}`;
  } catch {
    return href;
  }
}

function scrollToVaultHash(hash: string): void {
  const id = hash.replace(/^#/, '');
  if (!id) return;
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

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

  /** Prevent stuck pointer-events:none if client navigation never completes. */
  useEffect(() => {
    if (!isNavigating) return;
    const timer = window.setTimeout(() => setIsNavigating(false), 5_000);
    return () => window.clearTimeout(timer);
  }, [isNavigating]);

  /** Programmatic navigateVaultHref uses soft router.push when shell is mounted. */
  useEffect(() => {
    return registerVaultSoftNav((href) => {
      const normalized = normalizeVaultNavHref(href);
      if (!isVaultClientNavHref(normalized)) return false;
      if (isNativeCatchAllDynamicHref(normalized) || shouldUseNativeCatchAllNav(normalized)) {
        return false;
      }
      beginNavigation();
      router.push(normalized);
      notifyVaultNavigation();
      return true;
    });
  }, [router, beginNavigation]);

  useEffect(() => {
    warmVaultBottomNavRoutes(pathname);
    warmVaultDrawerRoutes(pathname);
  }, [pathname]);

  const prefetchedProfiles = useRef(new Set<string>());

  const warmPlayerLink = useCallback((href: string) => {
    const path = href.split('?')[0].split('#')[0];
    if (path.startsWith('/vault/recruiting')) {
      warmRecruitingHubApi();
    }
    if (isPlayerProfileHref(path)) {
      warmVaultPlayerRoute(path);
      const slug = playerSlugFromHref(path);
      if (slug && !prefetchedProfiles.current.has(slug)) {
        prefetchedProfiles.current.add(slug);
        prefetchFullProfile(slug);
      }
      return;
    }
    prefetchVaultHref(path);
  }, []);

  useEffect(() => {
    const shell = document.querySelector('.gv-vault-shell');
    if (!shell || typeof IntersectionObserver === 'undefined') return;

    const observed = new WeakSet<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const anchor = entry.target as HTMLAnchorElement;
          const href = anchor.getAttribute('href');
          if (href) warmPlayerLink(href);
          observer.unobserve(anchor);
        }
      },
      { rootMargin: '120px', threshold: 0.01 }
    );

    const scanLinks = () => {
      shell.querySelectorAll('a[href]').forEach((node) => {
        const anchor = node as HTMLAnchorElement;
        const href = anchor.getAttribute('href');
        if (!href || !isPlayerProfileHref(href) || observed.has(anchor)) return;
        observed.add(anchor);
        observer.observe(anchor);
      });
    };

    scanLinks();
    const mutation = new MutationObserver(scanLinks);
    mutation.observe(shell, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      mutation.disconnect();
    };
  }, [pathname, warmPlayerLink]);

  useEffect(() => {
    let lastHref = '';
    const warmFromAnchor = (anchor: HTMLAnchorElement | null) => {
      if (!anchor || !anchor.closest('.gv-vault-shell')) return;
      const href = anchor.getAttribute('href');
      if (!href || !isVaultClientNavHref(href)) return;
      const path = href.split('?')[0].split('#')[0];
      if (path === lastHref) return;
      lastHref = path;
      warmPlayerLink(href);
    };

    const onMouseOver = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest('a[href]') as HTMLAnchorElement | null;
      warmFromAnchor(anchor);
    };

    const onTouchStart = (event: TouchEvent) => {
      const anchor = (event.target as Element | null)?.closest('a[href]') as HTMLAnchorElement | null;
      warmFromAnchor(anchor);
    };

    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
    return () => {
      document.removeEventListener('mouseover', onMouseOver, true);
      document.removeEventListener('touchstart', onTouchStart, true);
    };
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;

      const anchor = (event.target as Element | null)?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      if (!anchor.closest('.gv-vault-shell')) return;
      if (anchor.hasAttribute('data-no-vault-nav')) return;

      const rawHref = anchor.getAttribute('href');
      if (!rawHref) return;
      // VaultNavLink sets data-vault-nav; still intercept catch-alls everywhere.
      if (
        anchor.hasAttribute('data-vault-nav') &&
        !isNativeCatchAllDynamicHref(rawHref) &&
        !shouldUseNativeCatchAllNav(rawHref)
      ) {
        return;
      }
      if (
        !isVaultClientNavHref(rawHref) &&
        !isNativeCatchAllDynamicHref(rawHref) &&
        !shouldUseNativeCatchAllNav(rawHref)
      ) {
        return;
      }

      const href = normalizeVaultNavHref(rawHref);
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;

      try {
        const target = new URL(href, window.location.origin);
        const here = new URL(current, window.location.origin);
        const samePath =
          target.pathname.replace(/\/$/, '') === here.pathname.replace(/\/$/, '') &&
          target.search === here.search;
        if (samePath && target.hash) {
          event.preventDefault();
          if (target.hash !== here.hash) {
            window.history.replaceState(null, '', `${target.pathname}${target.search}${target.hash}`);
          }
          scrollToVaultHash(target.hash);
          notifyVaultNavigation();
          return;
        }
      } catch {
        /* fall through to client nav */
      }

      if (vaultNavPathsEqual(href, current)) {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      beginNavigation();
      warmPlayerLink(href);
      // No per-slug index.html for player/article catch-alls — never router.push those.
      if (isNativeCatchAllDynamicHref(href) || shouldUseNativeCatchAllNav(href)) {
        navigateVaultHref(href);
        return;
      }
      router.push(href);
      notifyVaultNavigation();
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [router, beginNavigation, warmPlayerLink]);

  const value = useMemo(
    () => ({ isNavigating, beginNavigation }),
    [isNavigating, beginNavigation]
  );

  return <VaultNavContext.Provider value={value}>{children}</VaultNavContext.Provider>;
}
