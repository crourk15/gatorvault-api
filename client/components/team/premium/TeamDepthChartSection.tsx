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
  subtitle?: string;
};

export function TeamDepthChartSection({
  dcTab,
  onTabChange,
  positions,
  loading = false,
  subtitle,
}: Props): React.ReactElement {
  return (
    <div className="team-premium-section" id="depth-chart" data-section="depth-chart">
      <TeamPremiumModule
        title={TEAM_COPY.depthChart.title}
        subtitle={subtitle || TEAM_COPY.depthChart.subtitle}
        className="team-dc-module"
      >
        {loading ? (
          <TeamDepthChartSkeleton />
        ) : (
          <>
            <div className="gv-team-dc-legend" aria-label="Depth status key">
              <span className="gv-team-dc-legend-pill gv-team-dc-legend-pill--locked">
                <i aria-hidden="true" />
                Locked
              </span>
              <span className="gv-team-dc-legend-pill gv-team-dc-legend-pill--battle">
                <i aria-hidden="true" />
                Battle
              </span>
              <span className="gv-team-dc-legend-pill gv-team-dc-legend-pill--watch">
                <i aria-hidden="true" />
                Watch
              </span>
            </div>
            <DepthChartTabs active={dcTab} onChange={onTabChange} />
            <DepthChartGrid positions={positions} />
          </>
        )}
      </TeamPremiumModule>
    </div>
  );
}
