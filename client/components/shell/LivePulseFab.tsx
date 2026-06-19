'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from '@/lib/use-pathname';
import { isVaultPath } from '@/lib/vault-routes';
import { PremiumNavIcon } from '@/components/shell/PremiumNavIcons';

/** Center FAB — quick jump to live recruiting pulse feed. */
export function LivePulseFab(): React.ReactElement {
  const pathname = usePathname();
  const href = isVaultPath(pathname) ? '/vault/recruiting' : '/recruiting';

  return (
    <Link
      href={href}
      className="gv-live-pulse-fab"
      aria-label="Open live pulse feed"
      data-testid="live-pulse-fab"
    >
      <PremiumNavIcon id="pulse" className="gv-live-pulse-fab__icon" />
    </Link>
  );
}
