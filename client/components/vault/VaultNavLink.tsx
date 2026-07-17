'use client';

import React from 'react';
import Link from 'next/link';
import type { LinkProps } from 'next/link';
import { navigateNativeCatchAll, shouldUseNativeCatchAllNav } from '@/lib/native-spa-nav';
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
  // Hard block: vault chrome must never deep-link to marketing landing.
  const safeHref =
    href === '/' || href === '/welcome' || href === '/welcome/' || href.startsWith('/welcome?')
      ? '/vault/'
      : href;
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
        if (shouldUseNativeCatchAllNav(safeHref)) {
          event.preventDefault();
          beginNavigation();
          navigateNativeCatchAll(safeHref);
          onClick?.(event);
          return;
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
