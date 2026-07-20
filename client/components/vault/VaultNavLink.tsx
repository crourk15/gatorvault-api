'use client';

import React from 'react';
import Link from 'next/link';
import type { LinkProps } from 'next/link';
import { toAppRelativeHref } from '@/lib/app-href';
import { isNativeCatchAllDynamicHref } from '@/lib/native-spa-nav';
import { navigateVaultHref } from '@/lib/navigate-vault-href';
import { prefetchVaultHref, warmVaultPlayerRoute } from '@/lib/vault-navigation';
import { useVaultNavigation } from '@/components/vault/VaultNavigationProvider';

type Props = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> &
  LinkProps & {
    href: string;
    prefetchOnTouch?: boolean;
  };

/** In-vault navigation via Next client router — shell stays mounted. */
export function VaultNavLink({
  href,
  className,
  children,
  onClick,
  onMouseEnter,
  onFocus,
  onTouchStart,
  prefetchOnTouch = true,
  ...rest
}: Props): React.ReactElement {
  const { beginNavigation } = useVaultNavigation();
  // Never deep-link vault chrome to marketing landing.
  const relative = toAppRelativeHref(href);
  const safeHref =
    relative === '/' || relative === '/welcome' || relative === '/welcome/' || relative.startsWith('/welcome?')
      ? '/vault/'
      : relative;
  const path = safeHref.split('?')[0].split('#')[0];

  const warm = () => {
    if (/\/player\/|\/players\//.test(path)) warmVaultPlayerRoute(path);
    else prefetchVaultHref(path);
  };

  return (
    <Link
      href={safeHref}
      className={className}
      data-vault-nav=""
      prefetch
      scroll
      onClick={(event) => {
        // Catch-all player/article shells have no per-slug HTML — never let
        // Next client routing soft-nav into a missing file (→ marketing `/`).
        if (isNativeCatchAllDynamicHref(safeHref)) {
          event.preventDefault();
          beginNavigation();
          navigateVaultHref(safeHref);
          onClick?.(event);
          return;
        }
        // Hard-nav Home — soft-nav chunk failures reload the *current* route via
        // gv_retry and can leave users stuck (e.g. NIL → Home).
        const homePath = path.replace(/\/$/, '') || '/';
        if (homePath === '/vault') {
          const here =
            typeof window !== 'undefined'
              ? window.location.pathname.replace(/\/$/, '') || '/'
              : '';
          if (here !== '/vault') {
            event.preventDefault();
            beginNavigation();
            navigateVaultHref('/vault/');
            onClick?.(event);
            return;
          }
        }
        beginNavigation();
        onClick?.(event);
      }}
      onMouseEnter={(event) => {
        warm();
        onMouseEnter?.(event);
      }}
      onFocus={(event) => {
        warm();
        onFocus?.(event);
      }}
      onTouchStart={(event) => {
        if (prefetchOnTouch) warm();
        onTouchStart?.(event);
      }}
      {...rest}
    >
      {children}
    </Link>
  );
}
