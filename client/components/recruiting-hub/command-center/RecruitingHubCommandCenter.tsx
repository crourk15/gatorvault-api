'use client';

import React from 'react';
import type { HeatCheckItem } from '@/lib/recruiting-api';
import type { RecruitingBoardPlayer, RecruitingBoardResponse } from '@/lib/recruiting-board-api';
import type { MovementSummary } from '@/lib/recruiting-movement-api';
import type { StaffDashboardResponse } from '@/lib/staff-api';
import type { HighPriorityIntelItem } from '@/components/recruiting-hub/HighPriorityIntel/types';
import type { PortalBuckets } from '@/components/recruiting-hub/utils/portalData';
import { HeroPulse } from './HeroPulse';
import { HighPriorityIntelModule } from './HighPriorityIntelModule';
import { MovementIntelPanel } from './MovementIntelPanel';
import { StaffDashboardSnapshot } from './StaffDashboardSnapshot';
import { RecruitingBoardsOverview } from './RecruitingBoardsOverview';
import { PortalNilPulse } from './PortalNilPulse';
import { EcosystemTeaser } from './EcosystemTeaser';
import { TodayRecruitingFeed } from './TodayRecruitingFeed';

type ClassBundle = {
  commits: unknown[];
  targets: RecruitingBoardPlayer[];
  rankings: RecruitingBoardResponse['rankings'];
};

type Props = {
  b26: ClassBundle;
  b27: ClassBundle;
  b28: ClassBundle;
  movementSummary: MovementSummary | null;
  staffDashboard: StaffDashboardResponse | null;
  portal: PortalBuckets;
  rising: HeatCheckItem[];
  cooling: HeatCheckItem[];
  intelItems: HighPriorityIntelItem[];
  intelLoading: boolean;
  intelLastUpdated: string | null;
};

export function RecruitingHubCommandCenter({
  b26,
  b27,
  b28,
  movementSummary,
  staffDashboard,
  portal,
  rising,
  cooling,
  intelItems,
  intelLoading,
  intelLastUpdated,
}: Props): React.ReactElement {
  return (
    <div className="rh-cc-page" data-testid="rh-command-center">
      <HeroPulse
        rankings={b27.rankings}
        targets={b27.targets}
        movementSummary={movementSummary}
        staffDashboard={staffDashboard}
        intelItems={intelItems}
        rising={rising}
        cooling={cooling}
        lastUpdated={intelLastUpdated}
      />

      <div className="rh-cc-main rh-frame">
        <div className="rh-cc-col rh-cc-col--left">
          <HighPriorityIntelModule
            items={intelItems}
            loading={intelLoading}
            lastUpdated={intelLastUpdated}
          />
          <MovementIntelPanel />
          <StaffDashboardSnapshot staffDashboard={staffDashboard} />
        </div>

        <div className="rh-cc-col rh-cc-col--right">
          <RecruitingBoardsOverview b26={b26} b27={b27} b28={b28} />
          <PortalNilPulse portal={portal} />
          <EcosystemTeaser />
        </div>
      </div>

      <TodayRecruitingFeed
        intelItems={intelItems}
        movementSummary={movementSummary}
        staffDashboard={staffDashboard}
        rising={rising}
      />
    </div>
  );
}
