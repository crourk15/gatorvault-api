'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from '@/lib/use-pathname';
import { isVaultPath } from '@/lib/vault-routes';
import { PremiumNavIcon } from '@/components/shell/PremiumNavIcons';
import { useMobileViewport } from '@/lib/use-mobile-viewport';

/** Routes where the FAB overlaps dense scroll content (Lab / chase boards). */
function hideLivePulseFab(pathname: string): boolean {
  const p = String(pathname || '').replace(/\/+$/, '') || '/';
  if (p === '/vault/futurecast' || p.startsWith('/vault/futurecast/')) return true;
  if (p === '/futurecast' || p.startsWith('/futurecast/')) return true;
  // Recruiting priority chase boards: /vault/recruiting/2028/targets
  if (/\/vault\/recruiting\/\d{4}\/targets(?:\/|$)/.test(p)) return true;
  return false;
}

/** Center FAB — quick jump to live recruiting pulse feed. */
export function LivePulseFab(): React.ReactElement | null {
  const pathname = usePathname();
  const isMobile = useMobileViewport();
  const href = isVaultPath(pathname) ? '/vault/live' : '/gator-nation-live';

  if (!isMobile) return null;
  if (hideLivePulseFab(pathname)) return null;

  return (
    <Link
      href={href}
      className="gv-live-pulse-fab"
      aria-label="Open GatorNation Live"
      data-testid="live-pulse-fab"
    >
      <PremiumNavIcon id="pulse" className="gv-live-pulse-fab__icon" />
    </Link>
  );
}
