'use client';

import React from 'react';
import { DepthChartTabs } from '@/components/team/DepthChartTabs';
import { DepthChartGrid } from '@/components/team/DepthChartGrid';
import { TeamPremiumModule } from './TeamPremiumModule';
import type { DepthChartPosition, DepthChartTab } from '@/lib/team-hub-types';
import { TEAM_COPY } from '@/lib/team-hub-types';
import { TeamDepthChartSkeleton } from './TeamPageSkeleton';

type Props = {
  dcTab: DepthChartTab;
  onTabChange: (tab: DepthChartTab) => void;
  positions: DepthChartPosition[];
  loading?: boolean;
};

export function TeamDepthChartSection({
  dcTab,
  onTabChange,
  positions,
  loading = false,
}: Props): React.ReactElement {
  return (
    <div className="team-premium-section" id="depth-chart" data-section="depth-chart">
      <TeamPremiumModule
        title={TEAM_COPY.depthChart.title}
        subtitle={TEAM_COPY.depthChart.subtitle}
      >
        {loading ? (
          <TeamDepthChartSkeleton />
        ) : (
          <>
            <div className="gv-team-dc-legend team-premium-dc-legend">
              <span className="gv-team-dc-legend-pill gv-team-dc-legend-pill--locked">Locked</span>
              <span className="gv-team-dc-legend-pill gv-team-dc-legend-pill--battle">Battle</span>
              <span className="gv-team-dc-legend-pill gv-team-dc-legend-pill--watch">Watch</span>
            </div>
            <DepthChartTabs active={dcTab} onChange={onTabChange} />
            <DepthChartGrid positions={positions} />
          </>
        )}
      </TeamPremiumModule>
    </div>
  );
}
