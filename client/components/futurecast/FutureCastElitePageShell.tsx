'use client';

import React from 'react';
import '@/lib/futurecast-elite.css';
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

/** Shared shell — same page rhythm as Recruiting Hub (`rh-page--elite`). */
export function FutureCastElitePageShell({ segment, testId, children }: Props): React.ReactElement {
  const insider = isFutureCastInsider();
  const isDesktop = useIsCommandCenterDesktop();

  return (
    <div
      className="rh-page rh-page--elite fc-futurecast-page fc-futurecast-page--elite mobile-app gv-page"
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
