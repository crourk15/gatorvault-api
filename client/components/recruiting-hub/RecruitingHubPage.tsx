'use client';

import React from 'react';
import { UiError } from '@/components/site/UiMessage';
import { HeroCommandBar } from '@/components/recruiting-hub/HeroCommandBar';
import { ModuleRow } from '@/components/recruiting-hub/ModuleRow';
import { StickyTabsBar } from '@/components/recruiting-hub/StickyTabsBar';
import { HighPriorityIntelFeed } from '@/components/recruiting-hub/HighPriorityIntelFeed';
import { ClassOverview } from '@/components/recruiting-hub/ClassOverview';
import { HeadlinerSpotlight } from '@/components/recruiting-hub/HeadlinerSpotlight';
import { CommitsGrid } from '@/components/recruiting-hub/CommitsGrid';
import { ToolsBar } from '@/components/recruiting-hub/ToolsBar';
import { RecruitingHubTabPanels } from '@/components/recruiting-hub/RecruitingHubTabPanels';
import { RecruitingHubFooter } from '@/components/vault/recruiting/RecruitingHubFooter';
import { useRecruitingData } from '@/hooks/useRecruitingData';
import { useIntelFeed } from '@/hooks/useIntelFeed';

export function RecruitingHubPage(): React.ReactElement {
  const data = useRecruitingData();
  const { items: intelItems, loading: intelLoading } = useIntelFeed(data.highPriority);
  const showContent = data.loadedOnce && !data.error;

  return (
    <div className="rh-page" data-testid="vault-recruiting-hub">
      <HeroCommandBar />
      <ModuleRow />
      <StickyTabsBar active={data.tab} onChange={data.setTabAndUrl} />
      <HighPriorityIntelFeed items={intelItems} loading={intelLoading || (data.loading && !data.loadedOnce)} />
      {data.loadedOnce && !data.error ? (
        <>
          <ClassOverview b26={data.b26} b27={data.b27} b28={data.b28} />
          <HeadlinerSpotlight player={data.headliner} />
        </>
      ) : null}
      <CommitsGrid
        players={data.gridConfig.players}
        title={data.gridConfig.title}
        emptyMessage={data.gridConfig.emptyMessage}
        loading={data.loading && !data.loadedOnce}
      />

      <div className="rh-tab-panels-wrap">
        {data.loading && !data.loadedOnce && <p className="rh-status">Loading recruiting hub…</p>}
        {data.refreshing && data.loadedOnce && <p className="rh-status rh-status--inline">Refreshing…</p>}
        {data.error && !data.loading && (
          <UiError message={data.error} retry={data.reload} backHref="/vault" backLabel="← Dashboard" />
        )}
        <RecruitingHubTabPanels
          tab={data.tab}
          showContent={showContent}
          highPriority={data.highPriority}
          staffDashboard={data.staffDashboard}
          loading={data.loading}
          intel={data.intel}
          rankYear={data.rankYear}
          setRankYear={data.setRankYear}
          rankings={data.rankings}
        />
      </div>

      <ToolsBar />
      <RecruitingHubFooter />
    </div>
  );
}
