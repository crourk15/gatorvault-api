'use client';

import React, { useMemo } from 'react';
import { UiError } from '@/components/site/UiMessage';
import { PageTitleBar } from '@/components/recruiting-hub/PageTitleBar';
import { LivePulseBar } from '@/components/recruiting-hub/LivePulseBar';
import { MovementSummaryLine } from '@/components/recruiting-hub/MovementSummaryLine';
import { CommitsSection, mapCommits } from '@/components/recruiting-hub/Commits';
import { HighPriorityIntelGrid } from '@/components/recruiting-hub/HighPriorityIntel';
import { RecruitingBoardSection } from '@/components/recruiting-hub/RecruitingBoardSection';
import { FutureCastSection } from '@/components/recruiting-hub/FutureCastSection';
import { PortalTrackerSection } from '@/components/recruiting-hub/PortalTrackerSection';
import { NILTrackerSection } from '@/components/recruiting-hub/NILTrackerSection';
import { ClassEngineSection } from '@/components/recruiting-hub/ClassEngineSection';
import { DeepDiveSection } from '@/components/recruiting-hub/DeepDiveSection';
import { RecruitingHubFooter } from '@/components/vault/recruiting/RecruitingHubFooter';
import { useRecruitingData } from '@/hooks/useRecruitingData';
import { useIntelFeed } from '@/hooks/useIntelFeed';

export function RecruitingHubPage(): React.ReactElement {
  const data = useRecruitingData();
  const {
    items: highPriorityIntelItems,
    loading: intelLoading,
    lastUpdated: intelLastUpdated,
  } = useIntelFeed(data.highPriority);
  const showContent = data.loadedOnce && !data.error;

  const flipWatchCount = useMemo(
    () => data.highPriority.filter((p) => p.committedTo && p.committedTo !== 'Florida').length,
    [data.highPriority]
  );

  const commits2026 = useMemo(() => mapCommits(data.class2026.commits, 2026), [data.class2026.commits]);
  const commits2027 = useMemo(() => mapCommits(data.class2027.commits, 2027), [data.class2027.commits]);
  const commits2028 = useMemo(() => mapCommits(data.class2028.commits, 2028), [data.class2028.commits]);

  return (
    <div className="rh-page rh-vertical-dashboard" data-testid="vault-recruiting-hub">
      <PageTitleBar />

      {data.loading && !data.loadedOnce ? (
        <p className="rh-page__status rh-container">Loading recruiting hub…</p>
      ) : null}
      {data.error && !data.loading ? (
        <div className="rh-container">
          <UiError message={data.error} retry={data.reload} backHref="/vault" backLabel="← Home" />
        </div>
      ) : null}

      {showContent ? (
        <>
          <LivePulseBar
            rankings={data.b27.rankings}
            targets={data.b27.targets}
            rising={data.rising}
            cooling={data.cooling}
            flipWatchCount={flipWatchCount}
            portalStorm={flipWatchCount >= 2}
          />
          <MovementSummaryLine summary={data.movementSummary} />
          <CommitsSection
            commits2026={commits2026}
            commits2027={commits2027}
            commits2028={commits2028}
          />
          <HighPriorityIntelGrid
            items={highPriorityIntelItems}
            loading={intelLoading}
            lastUpdated={intelLastUpdated}
          />
          <RecruitingBoardSection targets={data.b27.targets} />
          <FutureCastSection
            players={data.highPriority}
            lastUpdated={data.highPriorityLastUpdated}
          />
          <PortalTrackerSection
            incoming={data.portal.incoming}
            targets={data.portal.targets}
            outgoing={data.portal.outgoing}
          />
          <NILTrackerSection players={data.highPriority} />
          <ClassEngineSection b26={data.b26} b27={data.b27} b28={data.b28} highPriority={data.highPriority} />
        </>
      ) : null}

      <DeepDiveSection />
      <RecruitingHubFooter />
    </div>
  );
}
