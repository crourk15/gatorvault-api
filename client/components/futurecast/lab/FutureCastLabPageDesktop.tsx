'use client';

import React from 'react';
import type { FutureCastPageData } from '@/lib/api/futurecast';
import { useIntelFeed } from '@/hooks/useIntelFeed';
import { FutureCastHero } from './FutureCastHero';
import { FutureCastTargetsPanel } from './FutureCastTargetsPanel';
import { FutureCastBattlesPanel } from './FutureCastBattlesPanel';
import { FutureCastAnalystSignals } from './FutureCastAnalystSignals';
import { FutureCastMovementPanel } from './FutureCastMovementPanel';
import { FutureCastPositionBreakdown } from './FutureCastPositionBreakdown';
import { FutureCastPortalCrossView } from './FutureCastPortalCrossView';
import { FutureCastLiveFeed } from './FutureCastLiveFeed';
import { useFutureCastLabData } from './useFutureCastLabData';

type Props = {
  data: FutureCastPageData;
};

export function FutureCastLabPageDesktop({ data }: Props): React.ReactElement {
  const labData = useFutureCastLabData();
  const { items: intelItems, loading: intelLoading, lastUpdated: intelLastUpdated } = useIntelFeed(
    data.highPriority
  );

  const competingDeltas = labData.competingDeltas?.items;

  return (
    <div className="fc-lab-page" data-testid="fc-lab-page-desktop">
      <FutureCastHero
        summary={data.summary}
        metrics={data.metrics}
        heatLevel={data.heatLevel}
        highPriority={data.highPriority}
        staffDashboard={labData.staffDashboard}
        movementSummary={labData.movementSummary}
        lastUpdated={intelLastUpdated ?? data.highPriorityLastUpdated}
      />

      <div className="fc-lab-main rh-frame">
        <div className="fc-lab-col fc-lab-col--left">
          <FutureCastTargetsPanel players={data.highPriority} competingDeltas={competingDeltas} />
          <FutureCastBattlesPanel players={data.highPriority} />
          <FutureCastAnalystSignals
            players={data.highPriority}
            intelItems={intelItems}
            loading={intelLoading}
            lastUpdated={intelLastUpdated}
          />
        </div>

        <div className="fc-lab-col fc-lab-col--right">
          <FutureCastMovementPanel initialData={labData.movementIntel} />
          <FutureCastPositionBreakdown players={data.highPriority} />
          <FutureCastPortalCrossView
            portalPlayers={data.home.portalWatchlist ?? []}
            highPriority={data.highPriority}
          />
        </div>
      </div>

      <FutureCastLiveFeed
        players={data.highPriority}
        intelItems={intelItems}
        movementIntel={labData.movementIntel}
        staffDashboard={labData.staffDashboard}
      />
    </div>
  );
}
