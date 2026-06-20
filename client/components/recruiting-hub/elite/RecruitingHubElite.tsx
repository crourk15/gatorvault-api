'use client';

import React, { useMemo } from 'react';
import '@/lib/recruiting-hub.css';
import type { HeatCheckItem } from '@/lib/recruiting-api';
import type { RecruitingBoardPlayer, RecruitingBoardResponse } from '@/lib/recruiting-board-api';
import type { MovementSummary } from '@/lib/recruiting-movement-api';
import type { StaffDashboardResponse } from '@/lib/staff-api';
import { RecruitingHeroStrip } from '@/components/recruiting-hub/elite/RecruitingHeroStrip';
import { RecruitingClassOverview } from '@/components/recruiting-hub/elite/RecruitingClassOverview';
import { RecruitingCommitBoard } from '@/components/recruiting-hub/elite/RecruitingCommitBoard';
import { RecruitingBattlesMovement } from '@/components/recruiting-hub/elite/RecruitingBattlesMovement';
import { RecruitingPositionSnapshot } from '@/components/recruiting-hub/elite/RecruitingPositionSnapshot';
import {
  buildBattleViews,
  buildClassMetrics,
  buildCommitViews,
  buildPositionRooms,
} from '@/components/recruiting-hub/elite/rh-elite-utils';

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
  loading?: boolean;
};

/** Recruiting Hub elite chrome — hero → class → commits → battles → position rooms. */
export function RecruitingHubElite({
  b27,
  movementSummary,
  staffDashboard,
  rising,
  loading,
}: Props): React.ReactElement {
  const classMetrics = useMemo(
    () => buildClassMetrics(b27.commits, b27.targets, b27.rankings, staffDashboard, movementSummary),
    [b27.commits, b27.targets, b27.rankings, staffDashboard, movementSummary]
  );

  const commits = useMemo(() => buildCommitViews(b27.commits), [b27.commits]);

  const battles = useMemo(
    () => buildBattleViews(b27.targets, rising, staffDashboard),
    [b27.targets, rising, staffDashboard]
  );

  const rooms = useMemo(
    () => buildPositionRooms(b27.commits, b27.targets),
    [b27.commits, b27.targets]
  );

  return (
    <div className="rh-frame rh-elite-chrome" data-testid="rh-elite-chrome">
      <RecruitingHeroStrip classYear={2027} />
      <RecruitingClassOverview metrics={classMetrics} loading={loading} />
      <RecruitingCommitBoard commits={commits} loading={loading} />
      <RecruitingBattlesMovement battles={battles} loading={loading} />
      <RecruitingPositionSnapshot rooms={rooms} loading={loading} />
    </div>
  );
}
