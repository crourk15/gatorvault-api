'use client';

import React, { useMemo } from 'react';
import { UiError } from '@/components/site/UiMessage';
import { RecruitingHubMobileHeader } from '@/components/recruiting-hub/RecruitingHubMobileHeader';
import { RecruitingHubFooter } from '@/components/vault/recruiting/RecruitingHubFooter';
import { RecruitingHubCommandCenter } from '@/components/recruiting-hub/command-center/RecruitingHubCommandCenter';
import { useRecruitingData } from '@/hooks/useRecruitingData';
import { useIntelFeed } from '@/hooks/useIntelFeed';
import { useIsCommandCenterDesktop } from '@/hooks/useIsCommandCenterDesktop';

export function RecruitingHubPage(): React.ReactElement {
  const data = useRecruitingData();
  const isCommandCenterDesktop = useIsCommandCenterDesktop();
  const {
    items: highPriorityIntelItems,
    loading: intelLoading,
    lastUpdated: intelLastUpdated,
  } = useIntelFeed(data.b27.targets);
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

      {showContent ? (
        <RecruitingHubCommandCenter
          b26={data.b26}
          b27={data.b27}
          b28={data.b28}
          movementSummary={data.movementSummary}
          staffDashboard={data.staffDashboard}
          portal={data.portal}
          rising={data.rising}
          cooling={data.cooling}
          intelItems={highPriorityIntelItems}
          intelLoading={intelLoading}
          intelLastUpdated={intelLastUpdated}
        />
      ) : null}

      <RecruitingHubFooter />
    </div>
  );
}
