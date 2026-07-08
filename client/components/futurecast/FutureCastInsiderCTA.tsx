'use client';

import React from 'react';
import { useUser } from '@/hooks/useUser';
import { useInsiderUnlock } from '@/lib/useUser';
import { usePathname } from '@/lib/use-pathname';

type Props = {
  message?: string;
  limit?: number;
  total?: number;
  ctaLabel?: string;
};

export function FutureCastInsiderCTA({
  message = 'Film Room unlocks full FutureCast — UF confidence, fit scores, movement intel, and staff notes.',
  limit,
  total,
  ctaLabel = 'Unlock FutureCast Insider',
}: Props): React.ReactElement | null {
  const pathname = usePathname();
  const { isInsider } = useUser();
  const { href: unlockHref, navigate: goToUnlock } = useInsiderUnlock({ returnPath: pathname });
  if (isInsider) return null;

  const prefix =
    total != null && limit != null && total > limit ? `Showing ${limit} of ${total} · ` : '';

  return (
    <div className="gv-paywall-gate" data-testid="fc-insider-cta">
      <img src="/icons/lock.svg" alt="" className="gv-paywall-lock-icon" />
      <p className="gv-paywall-text">
        {prefix}
        {message}
      </p>
      <a
        href={unlockHref}
        className="gv-paywall-cta"
        onClick={(e) => {
          e.preventDefault();
          goToUnlock();
        }}
      >
        {ctaLabel}
      </a>
    </div>
  );
}
