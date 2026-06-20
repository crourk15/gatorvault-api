'use client';

import React from 'react';
import { UiError } from '@/components/site/UiMessage';
import { RecruitingHubMobileHeader } from '@/components/recruiting-hub/RecruitingHubMobileHeader';
import { RecruitingHubFooter } from '@/components/vault/recruiting/RecruitingHubFooter';
import { RecruitingHubCommandCenter } from '@/components/recruiting-hub/command-center/RecruitingHubCommandCenter';
import { useRecruitingData } from '@/hooks/useRecruitingData';
import { useIsCommandCenterDesktop } from '@/hooks/useIsCommandCenterDesktop';

export function RecruitingHubPage(): React.ReactElement {
  const data = useRecruitingData();
  const isCommandCenterDesktop = useIsCommandCenterDesktop();
  const showContent = data.loadedOnce && !data.error;

  return (
    <div className="rh-page rh-page--elite mobile-app" data-testid="vault-recruiting-hub">
      {!isCommandCenterDesktop ? <RecruitingHubMobileHeader /> : null}

      {data.loading && !data.loadedOnce ? (
        <div className="rh-frame rh-cc-page" aria-busy="true" aria-label="Loading recruiting hub">
          <div className="rh-cc-skeleton" style={{ minHeight: 280, borderRadius: 12 }} />
          <div className="rh-cc-skeleton" style={{ minHeight: 200, borderRadius: 12, marginTop: 16 }} />
          <div className="rh-cc-skeleton" style={{ minHeight: 160, borderRadius: 12, marginTop: 16 }} />
        </div>
      ) : null}
      {data.error && !data.loading ? (
        <div className="rh-frame">
          <UiError message={data.error} retry={data.reload} backHref="/vault" backLabel="← Home" />
        </div>
      ) : null}

      {showContent ? <RecruitingHubCommandCenter /> : null}

      <RecruitingHubFooter />
    </div>
  );
}
