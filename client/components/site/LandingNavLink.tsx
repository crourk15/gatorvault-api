'use client';

import React from 'react';
import Link from 'next/link';
import type { LinkProps } from 'next/link';
import { VaultNavLink } from '@/components/vault/VaultNavLink';
import { isVaultClientNavHref } from '@/lib/vault-nav-utils';

type Props = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> &
  LinkProps & {
    href: string;
  };

/** Landing/marketing link — VaultNavLink for /vault/*, Next Link otherwise. */
export function LandingNavLink({ href, className, children, ...rest }: Props): React.ReactElement {
  if (isVaultClientNavHref(href)) {
    return (
      <VaultNavLink href={href} className={className} {...rest}>
        {children}
      </VaultNavLink>
    );
  }
  return (
    <Link href={href} className={className} prefetch {...rest}>
      {children}
    </Link>
  );
}
