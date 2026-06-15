'use client';

import React from 'react';
import '@/lib/futurecast-elite.css';
import { FutureCastSubNav } from '@/components/site/FutureCastSubNav';
import { isFutureCastInsider } from '@/lib/futurecast-insider';
import type { FutureCastSegment } from '@/lib/vault-route-map';

type Props = {
  segment: FutureCastSegment;
  testId: string;
  children: React.ReactNode;
};

/** Shared shell for all four FutureCast elite pages. */
export function FutureCastElitePageShell({ segment, testId, children }: Props): React.ReactElement {
  const insider = isFutureCastInsider();

  return (
    <div className="gv-page fc-futurecast-page fc-futurecast-page--elite" data-testid={testId}>
      <div className="gv-container">
        <FutureCastSubNav active={segment} />
        {children}
      </div>
      {!insider ? (
        <a href="/join" className="gv-paywall-sticky-cta">
          Unlock FutureCast Insider · Try FREE for 30 days
        </a>
      ) : null}
    </div>
  );
}
