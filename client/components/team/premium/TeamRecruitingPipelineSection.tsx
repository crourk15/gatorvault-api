'use client';

import React from 'react';
import type { PipelinePreviewData } from './team-premium-types';
import { TeamPremiumModule } from './TeamPremiumModule';
import { TeamPipelineSkeleton } from './TeamPageSkeleton';
import { PipelineMap } from './PipelineMap';
import { PipelineCommitsList } from './PipelineCommitsList';
import { PipelineTargetsList } from './PipelineTargetsList';
import { PipelineMetricsRow } from './PipelineMetricsRow';

type Props = {
  data: PipelinePreviewData;
  loading?: boolean;
};

export function TeamRecruitingPipelineSection({ data, loading }: Props): React.ReactElement {
  const classYear = data.classYear;
  const targetsHref = `/vault/recruiting/${classYear}/targets/`;
  const hasPreview =
    (data.topCommits?.length ?? 0) > 0 ||
    (data.topTargets?.length ?? 0) > 0 ||
    (data.stateCounts?.length ?? 0) > 0;

  return (
    <div className="team-premium-section" id="recruiting-pipeline" data-section="recruiting-pipeline">
      <TeamPremiumModule
        title="Recruiting Pipeline"
        subtitle={`${classYear} class — commits, targets, and state footprint`}
        stamp={hasPreview || !loading ? `${classYear} Board` : 'Updating…'}
        action={
          <a href={targetsHref} className="rh-cc-link">
            Open {classYear} targets →
          </a>
        }
      >
        {loading && !hasPreview ? (
          <TeamPipelineSkeleton />
        ) : (
          <>
            <PipelineMetricsRow
              avgFitScore={data.avgFitScore}
              avgFutureCastProb={data.avgFutureCastProb}
              classYear={classYear}
            />
            <div className="team-pipeline-layout">
              <PipelineMap states={data.stateCounts} />
              <PipelineCommitsList commits={data.topCommits} />
              <PipelineTargetsList targets={data.topTargets} />
            </div>
          </>
        )}
      </TeamPremiumModule>
    </div>
  );
}
