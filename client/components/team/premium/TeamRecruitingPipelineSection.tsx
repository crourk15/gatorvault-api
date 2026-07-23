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
  const boardHref = `/vault/recruiting/`;
  const commitCount = data.topCommits?.length ?? 0;
  const targetCount = data.topTargets?.length ?? 0;
  const hasPreview =
    commitCount > 0 || targetCount > 0 || (data.stateCounts?.length ?? 0) > 0;

  return (
    <div className="team-premium-section" id="recruiting-pipeline" data-section="recruiting-pipeline">
      <TeamPremiumModule
        title="Recruiting Pipeline"
        subtitle={`${classYear} class — commits, targets, and state footprint`}
        stamp={loading && !hasPreview ? 'Loading board…' : `${classYear} Board`}
        action={
          <a href={targetsHref} className="rh-cc-link">
            Open {classYear} targets →
          </a>
        }
        className="team-pipeline-module"
      >
        {loading && !hasPreview ? (
          <TeamPipelineSkeleton />
        ) : !hasPreview ? (
          <div className="team-pipeline-empty">
            <p className="team-pipeline-empty__kicker">{classYear} pipeline</p>
            <h3 className="team-pipeline-empty__title">Board not loaded yet</h3>
            <p className="team-pipeline-empty__copy">
              The class board didn&apos;t return commits or targets for this preview. Open Recruiting
              for the live Florida board.
            </p>
            <a href={boardHref} className="team-pipeline-empty__cta">
              Open Recruiting hub →
            </a>
          </div>
        ) : (
          <>
            <PipelineMetricsRow
              avgFitScore={data.avgFitScore}
              avgFutureCastProb={data.avgFutureCastProb}
              classYear={classYear}
              commitCount={commitCount}
              targetCount={targetCount}
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
