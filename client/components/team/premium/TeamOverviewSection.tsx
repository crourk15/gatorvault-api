'use client';

import React from 'react';
import { TeamPremiumModule } from './TeamPremiumModule';
import { TeamSnapshotGrid } from './TeamSnapshotGrid';
import { PositionRoomHealthBars } from './PositionRoomHealthBars';
import { PortalSnapshotModule } from './PortalSnapshotModule';
import { RecruitingPipelinePreview } from './RecruitingPipelinePreview';
import type { PipelinePreviewData, PortalSnapshotData } from './team-premium-types';
import {
  computePositionRoomHealth,
  computePortalSnapshot,
  computeSnapshotMetrics,
} from './team-premium-metrics';
import type { TeamHubBundle } from '@/lib/team-hub-api';
import { TeamOverviewSkeleton } from './TeamPageSkeleton';

type Props = {
  bundle: TeamHubBundle;
  pipelinePreview: PipelinePreviewData;
  suppressPipelinePreview?: boolean;
  loading?: boolean;
};

export function TeamOverviewSection({
  bundle,
  pipelinePreview,
  suppressPipelinePreview = false,
  loading = false,
}: Props): React.ReactElement {
  const snapshot = computeSnapshotMetrics(pipelinePreview.classYear);
  const rooms = computePositionRoomHealth();
  const portal: PortalSnapshotData = computePortalSnapshot(bundle);

  if (loading) {
    return (
      <div className="team-premium-section" id="overview" data-section="overview">
        <TeamPremiumModule title="Team Snapshot" subtitle="Program analytics at a glance">
          <TeamOverviewSkeleton />
        </TeamPremiumModule>
      </div>
    );
  }

  return (
    <div className="team-premium-section" id="overview" data-section="overview">
      <TeamPremiumModule title="Team Snapshot" subtitle="Program analytics at a glance">
        <TeamSnapshotGrid metrics={snapshot} />
      </TeamPremiumModule>

      <TeamPremiumModule title="Position Room Health" subtitle="Spring 2026 room grades">
        <PositionRoomHealthBars rooms={rooms} />
      </TeamPremiumModule>

      <TeamPremiumModule title="Portal Snapshot" subtitle="2026 transfer window impact">
        <PortalSnapshotModule data={portal} />
      </TeamPremiumModule>

      {!suppressPipelinePreview ? (
        <TeamPremiumModule
          title="Recruiting Pipeline Preview"
          subtitle={`${pipelinePreview.classYear} class outlook`}
        >
          <RecruitingPipelinePreview data={pipelinePreview} />
        </TeamPremiumModule>
      ) : null}
    </div>
  );
}
