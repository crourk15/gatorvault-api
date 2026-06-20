'use client';

import React from 'react';
import type { HeatCheckItem } from '@/lib/recruiting-api';
import type { RecruitingBoardPlayer, RecruitingBoardResponse } from '@/lib/recruiting-board-api';
import type { MovementSummary } from '@/lib/recruiting-movement-api';
import type { StaffDashboardResponse } from '@/lib/staff-api';
import { RecruitingHubElite } from '@/components/recruiting-hub/elite/RecruitingHubElite';

type ClassBundle = {
  commits: RecruitingBoardPlayer[];
  targets: RecruitingBoardPlayer[];
  rankings: RecruitingBoardResponse['rankings'];
};

type Props = {
  b27: ClassBundle;
  movementSummary: MovementSummary | null;
  staffDashboard: StaffDashboardResponse | null;
  rising: HeatCheckItem[];
  cooling: HeatCheckItem[];
};

/** Recruiting Hub command center — elite vertical chrome (2027 focus). */
export function RecruitingHubCommandCenter({
  b27,
  movementSummary,
  staffDashboard,
  rising,
}: Props): React.ReactElement {
  return (
    <div className="rh-cc-page" data-testid="rh-command-center">
      <RecruitingHubElite
        b27={b27}
        movementSummary={movementSummary}
        staffDashboard={staffDashboard}
        rising={rising}
      />
    </div>
  );
}
