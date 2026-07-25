'use client';

import React from 'react';
import { FutureCastSubNav } from '@/components/site/FutureCastSubNav';
import { useUser } from '@/hooks/useUser';
import { useInsiderUnlock } from '@/lib/useUser';
import { usePathname } from '@/lib/use-pathname';
import type { FutureCastSegment } from '@/lib/vault-route-map';

type Props = {
  segment: FutureCastSegment;
  testId: string;
  children: React.ReactNode;
};

/** Shared shell — hero owns page identity; no redundant mobile title strip. */
export function FutureCastElitePageShell({ segment, testId, children }: Props): React.ReactElement {
  const { isInsider: insider } = useUser();
  const pathname = usePathname();
  const { href: unlockHref, navigate: goToUnlock } = useInsiderUnlock({ returnPath: pathname });

  return (
    <div
      className="rh-page rh-page--elite fc-futurecast-page fc-futurecast-page--elite gv-fc-page mobile-app gv-page"
      data-testid={testId}
    >
      <div className="fc-futurecast-nav-wrap rh-frame">
        <FutureCastSubNav active={segment} />
      </div>
      {children}
      {!insider ? (
        <a
          href={unlockHref}
          className="gv-paywall-sticky-cta"
          onClick={(e) => {
            e.preventDefault();
            goToUnlock();
          }}
        >
          Unlock FutureCast Insider · Film Room from $9.99/mo
        </a>
      ) : null}
    </div>
  );
}
