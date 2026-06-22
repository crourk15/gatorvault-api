'use client';

import React from 'react';
import { RecruitingHubMobileHeader } from '@/components/recruiting-hub/RecruitingHubMobileHeader';
import { useIsCommandCenterDesktop } from '@/hooks/useIsCommandCenterDesktop';

/** Mobile-only chrome for recruiting hub landing. */
export function RecruitingHubPageChrome({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const isCommandCenterDesktop = useIsCommandCenterDesktop();

  return (
    <div className="rh-page rh-page--elite mobile-app" data-testid="vault-recruiting-hub">
      {!isCommandCenterDesktop ? <RecruitingHubMobileHeader /> : null}
      {children}
    </div>
  );
}
