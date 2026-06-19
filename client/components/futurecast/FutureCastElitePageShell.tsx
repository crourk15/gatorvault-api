'use client';

import React from 'react';
import { FutureCastSubNav } from '@/components/site/FutureCastSubNav';
import { FutureCastMobileHeader } from '@/components/futurecast/FutureCastMobileHeader';
import { isFutureCastInsider } from '@/lib/futurecast-insider';
import { useIsCommandCenterDesktop } from '@/hooks/useIsCommandCenterDesktop';
import type { FutureCastSegment } from '@/lib/vault-route-map';

type Props = {
  segment: FutureCastSegment;
  testId: string;
  children: React.ReactNode;
};

/** Shared shell — UF Premium Page standard (Recruiting Hub / NIL parity). */
export function FutureCastElitePageShell({ segment, testId, children }: Props): React.ReactElement {
  const insider = isFutureCastInsider();
  const isDesktop = useIsCommandCenterDesktop();

  return (
    <div
      className="rh-page rh-page--elite fc-futurecast-page fc-futurecast-page--elite gv-fc-page mobile-app gv-page"
      data-testid={testId}
    >
      {!isDesktop ? <FutureCastMobileHeader /> : null}
      <div className="fc-futurecast-nav-wrap rh-frame">
        <FutureCastSubNav active={segment} />
      </div>
      {children}
      {!insider ? (
        <a href="/join" className="gv-paywall-sticky-cta">
          Unlock FutureCast Insider · Try FREE for 30 days
        </a>
      ) : null}
    </div>
  );
}
