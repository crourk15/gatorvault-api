'use client';

import React from 'react';
import Link from 'next/link';
import type { LinkProps } from 'next/link';
import { prefetchVaultHref } from '@/lib/vault-navigation';
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
  const path = href.split('?')[0].split('#')[0];

  const warm = () => prefetchVaultHref(path);

  return (
    <Link
      href={href}
      className={className}
      data-vault-nav=""
      prefetch
      scroll
      onClick={(event) => {
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
