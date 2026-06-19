'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from '@/lib/use-pathname';
import { isVaultPath } from '@/lib/vault-routes';
import { PremiumNavIcon } from '@/components/shell/PremiumNavIcons';
import { useMobileViewport } from '@/lib/use-mobile-viewport';

/** Center FAB — quick jump to live recruiting pulse feed. */
export function LivePulseFab(): React.ReactElement | null {
  const pathname = usePathname();
  const isMobile = useMobileViewport();
  const href = isVaultPath(pathname) ? '/vault/recruiting' : '/recruiting';

  if (!isMobile) return null;

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
