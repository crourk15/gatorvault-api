'use client';

import React from 'react';
import type { PipelinePreviewData } from './team-premium-types';
import { TeamPremiumModule } from './TeamPremiumModule';
import { PipelineMap } from './PipelineMap';
import { PipelineCommitsList } from './PipelineCommitsList';
import { PipelineTargetsList } from './PipelineTargetsList';
import { PipelineMetricsRow } from './PipelineMetricsRow';

type Props = {
  data: PipelinePreviewData;
  loading?: boolean;
};

export function TeamRecruitingPipelineSection({ data, loading }: Props): React.ReactElement {
  return (
    <div className="team-premium-section" id="recruiting-pipeline" data-section="recruiting-pipeline">
      <TeamPremiumModule
        title="Recruiting Pipeline"
        subtitle="2027 class — commits, targets, and state footprint"
        stamp={loading ? 'Loading…' : '2027 Board'}
      >
        <PipelineMetricsRow avgFitScore={data.avgFitScore} avgFutureCastProb={data.avgFutureCastProb} />
        <div className="team-pipeline-layout">
          <PipelineMap states={data.stateCounts} />
          <PipelineCommitsList commits={data.topCommits} />
          <PipelineTargetsList targets={data.topTargets} />
        </div>
      </TeamPremiumModule>
    </div>
  );
}
