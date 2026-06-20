'use client';

import React from 'react';
import { RecruitingHubMobileHeader } from '@/components/recruiting-hub/RecruitingHubMobileHeader';
import { RecruitingHubCommandCenter } from '@/components/recruiting-hub/command-center/RecruitingHubCommandCenter';
import { useIsCommandCenterDesktop } from '@/hooks/useIsCommandCenterDesktop';

export function RecruitingHubPage(): React.ReactElement {
  const isCommandCenterDesktop = useIsCommandCenterDesktop();

  return (
    <div className="rh-page rh-page--elite mobile-app" data-testid="vault-recruiting-hub">
      {!isCommandCenterDesktop ? <RecruitingHubMobileHeader /> : null}
      <RecruitingHubCommandCenter />
    </div>
  );
}
