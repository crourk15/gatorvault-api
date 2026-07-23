'use client';

import React from 'react';

type Props = {
  avgFitScore: number;
  avgFutureCastProb: number;
  classYear?: number;
  commitCount?: number;
  targetCount?: number;
};

export function PipelineMetricsRow({
  avgFitScore,
  avgFutureCastProb,
  classYear = 2028,
  commitCount = 0,
  targetCount = 0,
}: Props): React.ReactElement {
  return (
    <div className="team-pipeline-metrics team-pipeline-metrics--board" aria-label="Pipeline metrics">
      <div className="team-pipeline-metrics__card">
        <span className="team-pipeline-metrics__label">Class</span>
        <span className="team-pipeline-metrics__value">{classYear}</span>
      </div>
      <div className="team-pipeline-metrics__card">
        <span className="team-pipeline-metrics__label">Top commits</span>
        <span className="team-pipeline-metrics__value">{commitCount || '—'}</span>
      </div>
      <div className="team-pipeline-metrics__card">
        <span className="team-pipeline-metrics__label">Top targets</span>
        <span className="team-pipeline-metrics__value">{targetCount || '—'}</span>
      </div>
      <div className="team-pipeline-metrics__card">
        <span className="team-pipeline-metrics__label">Avg fit</span>
        <span className="team-pipeline-metrics__value">{avgFitScore > 0 ? avgFitScore : '—'}</span>
      </div>
      <div className="team-pipeline-metrics__card">
        <span className="team-pipeline-metrics__label">FutureCast</span>
        <span className="team-pipeline-metrics__value">
          {avgFutureCastProb > 0 ? `${avgFutureCastProb}%` : '—'}
        </span>
      </div>
    </div>
  );
}
